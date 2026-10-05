// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {ManageResult} from "@/core/preview/request";
import manage from "@/features/manage/index";
import {useUiStore} from "@/stores/ui";

import {type Running, runModule} from "../module";

const deletePost = vi.hoisted(() => vi.fn<(target: { gallery: string; id: string; link: string }) => Promise<ManageResult>>());
vi.mock("@/core/preview/request", () => ({deletePost}));

// jsdom에는 CSS.escape가 없다. 테스트 값(영문·숫자·점)에는 따옴표·역슬래시만 막으면 된다.
vi.stubGlobal("CSS", {escape: (value: string) => value.replace(/["\\]/g, "\\$&")});

interface Writer {
    no: string;
    uid?: string;
    ip?: string;
    nick?: string;
}

const row = ({no, uid = "", ip = "", nick = "ㅇㅇ"}: Writer): string =>
    `<tr class="ub-content" data-no="${no}"><td class="gall_chk"><input type="checkbox" class="article_chkbox" value="${no}"></td>` +
    `<td class="gall_tit"><a href="#${no}">글</a><a class="reply_numbox">[1]</a></td>` +
    `<td class="gall_writer ub-writer" data-nick="${nick}" data-uid="${uid}" data-ip="${ip}"></td></tr>`;

const mountList = (writers: Writer[], manager = true): void => {
    document.body.innerHTML = `${manager ? "<div class=\"useradmin_btnbox\"><button>관리</button></div>" : ""}` +
        `<table class="gall_list"><tbody>${writers.map(row).join("")}</tbody></table>`;
};

const box = (no: string): HTMLInputElement => document.querySelector<HTMLInputElement>(`tr[data-no="${no}"] .article_chkbox`)!;
const checked = (): string[] => Array.from(document.querySelectorAll<HTMLInputElement>(".article_chkbox:checked"), (input) => input.value);
const click = (target: Element, init: MouseEventInit = {}): MouseEvent => {
    const ev = new MouseEvent("click", {bubbles: true, cancelable: true, ...init});
    target.dispatchEvent(ev);
    return ev;
};

let running: Running<void> | undefined;
const start = async (patch = {}) => (running = await runModule(manage, patch));

beforeEach(() => {
    useUiStore.setState({toasts: []});
});

afterEach(() => {
    running?.stop();
    running = undefined;
    document.body.innerHTML = "";
});

describe("체크박스 편의", () => {
    it("Shift+클릭은 같은 유저의 글을 모두 체크한다 (아이디·IP·닉네임 순)", async () => {
        mountList([{no: "1", uid: "a"}, {no: "2", uid: "a"}, {no: "3", uid: "b"}, {no: "4", ip: "1.2"}, {no: "5", ip: "1.2"}, {no: "6", ip: "3.4"}]);
        await start({checkAllTargetUser: true});

        box("1").click();
        click(box("1"), {shiftKey: true});
        expect(checked()).toEqual([]);
        click(box("1"), {shiftKey: true});
        expect(checked()).toEqual(["1", "2"]);

        // 유동은 아이디가 비어 있다. IP로 골라야 회원 글이 잡히지 않는다.
        click(box("4"), {shiftKey: true});
        expect(checked()).toEqual(["1", "2", "4", "5"]);
    });

    it("설정을 끄면 Shift+클릭은 그 칸만 체크한다", async () => {
        mountList([{no: "1", uid: "a"}, {no: "2", uid: "a"}]);
        await start();
        click(box("1"), {shiftKey: true});
        expect(checked()).toEqual(["1"]);
    });

    it("Ctrl+클릭은 댓글의 대댓글도 체크한다", async () => {
        document.body.innerHTML = "<ul>" +
            "<li id=\"comment_li_5\"><div class=\"cmt_nickbox\"><input type=\"checkbox\" class=\"article_chkbox\" value=\"5\"></div></li>" +
            "<li><ul id=\"reply_list_5\"><li id=\"reply_li_6\"><input type=\"checkbox\" class=\"article_chkbox\" value=\"6\"></li><li><input type=\"checkbox\" class=\"article_chkbox\" value=\"7\"></li></ul></li>" +
            "<li id=\"comment_li_8\"><input type=\"checkbox\" class=\"article_chkbox\" value=\"8\"></li>" +
            "</ul>";
        await start({checkCommentViaCtrl: true});
        click(document.querySelector("#comment_li_5 .article_chkbox")!, {ctrlKey: true});
        expect(checked()).toEqual(["5", "6", "7"]);
    });

    it("Shift를 누른 채 왼쪽 버튼으로 지나간 칸만 체크한다", async () => {
        mountList([{no: "1"}, {no: "2"}, {no: "3"}]);
        await start({checkViaShift: true});
        box("1").dispatchEvent(new MouseEvent("mouseout", {shiftKey: true, buttons: 1}));
        box("2").dispatchEvent(new MouseEvent("mouseover", {shiftKey: true, buttons: 1}));
        box("3").dispatchEvent(new MouseEvent("mouseover", {shiftKey: true, buttons: 0}));
        expect(checked()).toEqual(["1", "2"]);
    });

    it("새로 그려진 행에도 붙는다", async () => {
        mountList([{no: "1", uid: "a"}]);
        await start({checkAllTargetUser: true});
        document.querySelector("tbody")!.insertAdjacentHTML("beforeend", row({no: "2", uid: "a"}));
        await vi.waitFor(() => {
            box("2").checked = false;
            click(box("2"), {shiftKey: true});
            expect(checked()).toEqual(["1", "2"]);
        });
    });
});

describe("Ctrl 클릭 삭제", () => {
    it("관리하는 갤러리에서 글 행을 Ctrl+클릭하면 지우고 행을 뗀다", async () => {
        deletePost.mockResolvedValue({success: true});
        mountList([{no: "1"}, {no: "2"}]);
        await start({deleteViaCtrl: true});
        const ev = click(document.querySelector("tr[data-no='1'] .gall_tit a")!, {ctrlKey: true});
        expect(ev.defaultPrevented).toBe(true);
        expect(deletePost).toHaveBeenCalledWith({gallery: "test", id: "1", link: location.href});
        await vi.waitFor(() => expect(document.querySelector("tr[data-no='1']")).toBeNull());
        expect(useUiStore.getState().toasts.at(-1)?.content).toBe("게시글을 삭제했습니다.");
    });

    it("실패하면 행을 남긴다", async () => {
        deletePost.mockResolvedValue({success: false, message: "권한이 없습니다."});
        mountList([{no: "1"}]);
        await start({deleteViaCtrl: true});
        click(document.querySelector("tr[data-no='1'] .gall_tit a")!, {ctrlKey: true});
        await vi.waitFor(() => expect(useUiStore.getState().toasts.at(-1)?.content).toBe("권한이 없습니다."));
        expect(document.querySelector("tr[data-no='1']")).not.toBeNull();
    });

    it("응답 전에 다시 눌러도 한 번만 보낸다", async () => {
        let finish!: (result: ManageResult) => void;
        deletePost.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        mountList([{no: "1"}]);
        await start({deleteViaCtrl: true});
        const title = document.querySelector("tr[data-no='1'] .gall_tit a")!;
        click(title, {ctrlKey: true});
        const again = click(title, {ctrlKey: true});
        expect(again.defaultPrevented).toBe(true);
        expect(deletePost).toHaveBeenCalledTimes(1);
        finish({success: false});
    });

    it("관리 권한이 없거나 체크박스·댓글 수 칸이면 가로채지 않는다", async () => {
        mountList([{no: "1"}], false);
        await start({deleteViaCtrl: true});
        expect(click(document.querySelector(".gall_tit a")!, {ctrlKey: true}).defaultPrevented).toBe(false);

        document.body.insertAdjacentHTML("afterbegin", "<div class=\"useradmin_btnbox\"><button>관리</button></div>");
        click(box("1"), {ctrlKey: true});
        click(document.querySelector(".reply_numbox")!, {ctrlKey: true});
        expect(deletePost).not.toHaveBeenCalled();
    });

    it("Ctrl 없이 누르거나 설정이 꺼져 있으면 지우지 않는다", async () => {
        mountList([{no: "1"}]);
        const {change} = await start({deleteViaCtrl: true});
        click(document.querySelector(".gall_tit a")!);
        change({deleteViaCtrl: false});
        click(document.querySelector(".gall_tit a")!, {ctrlKey: true});
        expect(deletePost).not.toHaveBeenCalled();
    });
});

describe("GIF 조작", () => {
    const VIDEOS = "<div class=\"gallview_contents\"><video id=\"gif\" onmousedown=\"dcGif(this)\" data-src=\"https://dcimg.dcinside.com/a.gif\"></video>" +
        "<video id=\"dccon\" data-src=\"https://dcimg5.dcinside.com/dccon.php?no=1\"></video></div>";

    it("움짤에 컨트롤을 달고 끄면 원래대로 되돌린다", async () => {
        document.body.innerHTML = VIDEOS;
        const {change} = await start({enableGifControl: true});
        const gif = document.getElementById("gif")!;
        expect(gif.hasAttribute("controls")).toBe(true);
        expect(gif.hasAttribute("onmousedown")).toBe(false);
        expect(document.getElementById("dccon")?.hasAttribute("controls")).toBe(false);

        change({enableGifControl: false});
        expect(gif.hasAttribute("controls")).toBe(false);
        expect(gif.getAttribute("onmousedown")).toBe("dcGif(this)");

        change({enableGifControl: true});
        expect(gif.hasAttribute("controls")).toBe(true);
    });

    it("모듈을 끄면 되돌린다", async () => {
        document.body.innerHTML = VIDEOS;
        const {stop} = await start({enableGifControl: true});
        stop();
        running = undefined;
        expect(document.getElementById("gif")?.getAttribute("onmousedown")).toBe("dcGif(this)");
    });
});
