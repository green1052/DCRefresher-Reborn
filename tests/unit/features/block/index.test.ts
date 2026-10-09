// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import type {BlockEntry, DetectMode} from "@/core/storage/types";
import block from "@/features/block/index";
import {useUiStore} from "@/stores/ui";

import {setBlockLists, tick} from "../../../helpers";
import {type Running, runModule} from "../module";

interface RowFields {
    no: string;
    nick?: string;
    uid?: string;
    title?: string;
    subject?: string;
}

const row = ({no, nick = "ㅇㅇ", uid = "", title = `글 ${no}`, subject = "일반"}: RowFields): string =>
    `<tr class="ub-content" data-no="${no}"><td class="gall_subject">${subject}</td>` +
    `<td class="gall_tit"><a href="/board/view/?id=test&no=${no}">${title}</a></td>` +
    `<td class="gall_writer ub-writer" data-nick="${nick}" data-uid="${uid}" data-ip="1.2"></td></tr>`;

const entry = (content: string, fields: { mode?: DetectMode; gallery?: string; isRegex?: boolean } = {}): BlockEntry =>
    ({id: `${content}-${fields.gallery ?? ""}`, content, isRegex: false, ...fields});

const rowOf = (no: string): HTMLElement => document.querySelector<HTMLElement>(`tr[data-no="${no}"]`)!;

const hidden = (): string[] =>
    Array.from(document.querySelectorAll<HTMLElement>("tr.refresherBlocked, tr.refresherBlur"), (tr) => tr.dataset.no ?? "");

let running: Running<{ isRevealed(): boolean; hiddenCount(): number; toggleReveal(): void }> | undefined;

const start = async (patch = {}) => (running = await runModule(block, patch));

beforeEach(() => {
    document.body.innerHTML = `<table class="gall_list"><tbody>${[
        row({no: "1", nick: "도배", uid: "spam"}),
        row({no: "2", nick: "착한", title: "광고 <script>var 광고 = 1</script>아님"}),
        row({no: "3", subject: "<span class=\"subject_inner\">긴 말머리 전체</span>"})
    ].join("")}</tbody></table>`;
    setBlockLists();
    useUiStore.setState({toasts: [], blockRevealed: false, selected: null, bubble: null});
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

describe("작성자 칸 판정", () => {
    it("닉네임·아이디로 막은 행을 숨긴다", async () => {
        setBlockLists({NICK: [entry("도배")]});
        await start();
        expect(hidden()).toEqual(["1"]);
        expect(rowOf("1").classList.contains("refresherBlocked")).toBe(true);
    });

    it("blur면 흐리게 한다", async () => {
        setBlockLists({ID: [entry("spam")]});
        await start({blur: true});
        expect(rowOf("1").classList.contains("refresherBlur")).toBe(true);
        expect(rowOf("1").classList.contains("refresherBlocked")).toBe(false);
    });

    it("제목은 <script> 글자를 빼고 본다", async () => {
        setBlockLists({TITLE: [entry("광고", {mode: "SAME"})]});
        await start();
        expect(hidden()).toEqual([]);

        setBlockLists({TITLE: [entry("광고 아님", {mode: "SAME"})]});
        expect(hidden()).toEqual(["2"]);
    });

    it("잘린 말머리는 툴팁의 전체 글자로 본다", async () => {
        setBlockLists({TAB: [entry("긴 말머리 전체")]});
        await start();
        expect(hidden()).toEqual(["3"]);
    });

    it("다른 갤러리 한정 항목은 쓰지 않는다", async () => {
        setBlockLists({NICK: [entry("도배", {gallery: "other"}), entry("착한", {gallery: "test"})]});
        await start();
        expect(hidden()).toEqual(["2"]);
    });

    it("새로 그려진 행도 판정한다", async () => {
        setBlockLists({NICK: [entry("도배")]});
        await start();
        document.querySelector("tbody")!.insertAdjacentHTML("beforeend", row({no: "4", nick: "도배"}));
        await tick();
        expect(hidden()).toEqual(["1", "4"]);
    });

    it("차단 목록이 바뀌면 그려진 행을 다시 판정한다", async () => {
        setBlockLists({NICK: [entry("도배")]});
        await start();
        setBlockLists({NICK: [entry("착한")]});
        expect(hidden()).toEqual(["2"]);
        setBlockLists();
        expect(hidden()).toEqual([]);
    });

    it("숨기는 방식을 바꾸면 다시 판정한다", async () => {
        setBlockLists({NICK: [entry("도배")]});
        const {change} = await start();
        change({blur: true});
        expect(rowOf("1").className).toContain("refresherBlur");
        expect(rowOf("1").className).not.toContain("refresherBlocked");
    });
});

describe("대댓글·디시콘", () => {
    const comments = (): void => {
        document.body.innerHTML = "<ul class=\"cmt_list\">" +
            "<li class=\"ub-content\" id=\"comment_li_1\"><span class=\"ub-writer\" data-nick=\"도배\" data-uid=\"\" data-ip=\"\"></span></li>" +
            "<li id=\"reply_wrap\"><div class=\"reply\"><ul><li class=\"ub-content\"><span class=\"ub-writer\" data-nick=\"남\" data-uid=\"\" data-ip=\"\"></span></li></ul></div></li>" +
            "<li class=\"ub-content\" id=\"comment_li_2\"><div class=\"comment_dccon\"><img class=\"written_dccon\" src=\"https://dcimg5.dcinside.com/dccon.php?no=bad\"></div></li>" +
            "</ul>";
    };

    it("replyRemove면 막은 댓글의 대댓글 칸도 가린다", async () => {
        comments();
        setBlockLists({NICK: [entry("도배")]});
        await start({replyRemove: true});
        expect(document.getElementById("reply_wrap")?.classList.contains("refresherBlocked")).toBe(true);
    });

    it("replyRemove가 아니면 대댓글은 둔다", async () => {
        comments();
        setBlockLists({NICK: [entry("도배")]});
        await start();
        expect(document.getElementById("comment_li_1")?.classList.contains("refresherBlocked")).toBe(true);
        expect(document.getElementById("reply_wrap")?.classList.contains("refresherBlocked")).toBe(false);
    });

    it("막은 디시콘은 그 댓글을, 칸이 없으면 디시콘만 가린다", async () => {
        comments();
        document.body.insertAdjacentHTML("beforeend", "<div class=\"write_div\"><img id=\"body-dccon\" class=\"written_dccon\" src=\"https://dcimg5.dcinside.com/dccon.php?no=bad\"></div>");
        setBlockLists({DCCON: [entry("bad")]});
        await start();
        expect(document.getElementById("comment_li_2")?.classList.contains("refresherBlocked")).toBe(true);
        expect(document.getElementById("body-dccon")?.classList.contains("refresherBlocked")).toBe(true);
    });
});

describe("보기 방식·가린 내용 보기", () => {
    it("블러 강도·마우스 오버 보기를 <html>에 건다", async () => {
        const {change} = await start({blur: true, blurStrength: 7});
        const root = document.documentElement;
        expect(root.style.getPropertyValue("--refresher-blur")).toBe("7px");
        expect(root.classList.contains("refresherBlurReveal")).toBe(true);

        change({blurReveal: false, blurStrength: 3});
        expect(root.style.getPropertyValue("--refresher-blur")).toBe("3px");
        expect(root.classList.contains("refresherBlurReveal")).toBe(false);
    });

    it("가린 내용 보기를 켜고 끈다", async () => {
        setBlockLists({NICK: [entry("도배"), entry("착한")]});
        const {api} = await start();
        expect(api.hiddenCount()).toBe(2);

        api.toggleReveal();
        expect(api.isRevealed()).toBe(true);
        expect(document.documentElement.classList.contains("refresherBlockReveal")).toBe(true);
        expect(useUiStore.getState().blockRevealed).toBe(true);
        expect(useUiStore.getState().toasts.at(-1)?.content).toBe("이 페이지에서 가린 내용을 보입니다. (2개)");

        api.toggleReveal();
        expect(api.isRevealed()).toBe(false);
        expect(useUiStore.getState().toasts.at(-1)?.content).toBe("가린 내용을 다시 숨겼습니다.");
    });

    it("팝업 토글이 가린 수를 보인다", async () => {
        setBlockLists({NICK: [entry("도배")]});
        const {api} = await start();
        const toggle = block.pageToggles?.[0];
        const desc = toggle?.desc;
        expect(typeof desc === "function" ? desc(api) : desc).toBe("가린 1개를 흐리게 보입니다");
    });

    it("모듈을 끄면 가린 것과 표시를 모두 되돌린다", async () => {
        setBlockLists({NICK: [entry("도배")]});
        const {api, stop} = await start({blur: true});
        api.toggleReveal();
        stop();
        running = undefined;
        const root = document.documentElement;
        expect(hidden()).toEqual([]);
        expect(root.classList.contains("refresherBlockReveal")).toBe(false);
        expect(root.classList.contains("refresherBlurReveal")).toBe(false);
        expect(root.style.getPropertyValue("--refresher-blur")).toBe("");
        expect(useUiStore.getState().blockRevealed).toBe(false);

        // 꺼진 뒤에는 목록이 바뀌어도 다시 가리지 않는다.
        setBlockLists({NICK: [entry("착한")]});
        expect(hidden()).toEqual([]);
    });
});

describe("우클릭", () => {
    const contextMenu = (target: Element, init: MouseEventInit = {}): MouseEvent => {
        const ev = new MouseEvent("contextmenu", {bubbles: true, cancelable: true, clientX: 10, clientY: 20, ...init});
        target.dispatchEvent(ev);
        return ev;
    };

    it("디시콘을 우클릭하면 디시콘 차단 버블을 연다", async () => {
        document.body.insertAdjacentHTML("beforeend", "<img class=\"written_dccon\" src=\"https://dcimg5.dcinside.com/dccon.php?no=abc\">");
        await start();
        const ev = contextMenu(document.querySelector(".written_dccon")!);
        expect(ev.defaultPrevented).toBe(true);
        expect(useUiStore.getState().selected).toEqual({dccon: "abc"});
        expect(useUiStore.getState().bubble).toEqual({x: 10, y: 20});
    });

    it("작성자 칸을 우클릭하면 유저 버블을 연다", async () => {
        await start();
        contextMenu(rowOf("1").querySelector(".ub-writer")!);
        expect(useUiStore.getState().selected).toEqual({nick: "도배", uid: "spam", ip: "1.2"});
    });

    it("Shift+우클릭은 브라우저 메뉴로 둔다", async () => {
        await start();
        const ev = contextMenu(rowOf("1").querySelector(".ub-writer")!, {shiftKey: true});
        expect(ev.defaultPrevented).toBe(false);
        expect(useUiStore.getState().bubble).toBeNull();
    });
});
