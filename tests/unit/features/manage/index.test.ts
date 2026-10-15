// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import manage from "@/features/manage/index";
import {useUiStore} from "@/stores/ui";

import {tick} from "../../../helpers";
import {type Running, runModule} from "../module";

const deletePost = vi.hoisted(() => vi.fn(async () => ({success: true})));
vi.mock("@/core/preview/request", async (importOriginal) => ({...await importOriginal<typeof import("@/core/preview/request")>(), deletePost}));
vi.mock("@/stores/notify", () => ({notifyManage: async (request: Promise<{ success: boolean }>) => (await request).success}));
const searchPosts = vi.hoisted(() => vi.fn<(query: string) => Promise<string>>());
vi.mock("@/core/messaging/protocol", () => ({sendMessage: (_type: string, query: string) => searchPosts(query)}));

let running: Running<unknown> | undefined;
const start = async (patch = {}) => (running = await runModule(manage, patch));

afterEach(() => {
    running?.stop();
    running = undefined;
});

describe("Ctrl+클릭 삭제", () => {
    /** manager: 관리 권한이 있는 목록(디시는 관리자에게만 체크박스 칸 머리를 둔다). */
    const mountList = (manager: boolean): void => {
        document.body.innerHTML =
            "<table class=\"gall_list\">" +
            (manager ? "<thead><tr><th class=\"chkbox_th\"></th></tr></thead>" : "") +
            "<tbody><tr class=\"ub-content\" data-no=\"7\"><td><input type=\"checkbox\" class=\"article_chkbox\"></td>" +
            "<td class=\"gall_tit\"><a href=\"/board/view/?id=test&no=7\">제목</a><a class=\"reply_numbox\">[3]</a></td></tr></tbody></table>";
    };
    const row = (): HTMLElement => document.querySelector(".ub-content")!;
    const ctrlClick = (target: Element): boolean => target.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true, ctrlKey: true}));

    beforeEach(() => deletePost.mockClear());

    it("관리하는 갤러리에서 제목을 Ctrl+클릭하면 글을 지우고 행을 뺀다", async () => {
        mountList(true);
        await start({deleteViaCtrl: true});
        const title = row().querySelector(".gall_tit a")!;

        expect(ctrlClick(title)).toBe(false);
        // 응답 전에 다시 눌러도 요청을 또 보내지 않는다.
        ctrlClick(title);
        await tick();
        expect(deletePost).toHaveBeenCalledOnce();
        expect(deletePost).toHaveBeenCalledWith(expect.objectContaining({gallery: "test", id: "7"}));
        expect(document.querySelector(".ub-content")).toBeNull();
    });

    it("주소를 다른 갤러리 글로 바꿔도 이 문서의 갤러리 글로 지운다", async () => {
        mountList(true);
        await start({deleteViaCtrl: true});
        history.replaceState(null, "", "/board/view/?id=other&no=5");
        try {
            ctrlClick(row().querySelector(".gall_tit a")!);
            await tick();
            expect(deletePost).toHaveBeenCalledWith(expect.objectContaining({gallery: "test", id: "7", link: "https://gall.dcinside.com/board/lists/?id=test"}));
        } finally {
            history.replaceState(null, "", "/board/lists/?id=test");
        }
    });

    it("관리하지 않는 갤러리, 설정을 끈 때, 체크박스 칸·댓글 수는 지우지 않고 클릭을 그대로 둔다", async () => {
        mountList(false);
        await start({deleteViaCtrl: true});
        expect(ctrlClick(row().querySelector(".gall_tit a")!)).toBe(true);
        running?.stop();

        mountList(true);
        await start({deleteViaCtrl: false});
        expect(ctrlClick(row().querySelector(".gall_tit a")!)).toBe(true);
        running?.stop();

        mountList(true);
        await start({deleteViaCtrl: true});
        expect(ctrlClick(row().querySelector(".article_chkbox")!)).toBe(true);
        expect(ctrlClick(row().querySelector(".reply_numbox")!)).toBe(true);

        await tick();
        expect(deletePost).not.toHaveBeenCalled();
    });
});

describe("Shift+클릭으로 같은 작성자 글 체크", () => {
    const writer = "<td class=\"gall_writer ub-writer\" data-uid=\"a\" data-ip=\"\" data-nick=\"닉\"></td>";

    it("체크박스를 처음 볼 때 작성자 칸이 아직 없던 행도 누를 때 작성자를 찾는다", async () => {
        // 문서를 읽는 중에는 체크박스 칸만 먼저 붙고 작성자 칸은 나중에 붙는다.
        document.body.innerHTML = "<table class=\"gall_list\"><tbody>" +
            "<tr class=\"ub-content\" data-no=\"1\"><td><input type=\"checkbox\" class=\"article_chkbox\"></td></tr>" +
            `<tr class="ub-content" data-no="2"><td><input type="checkbox" class="article_chkbox"></td>${writer}</tr></tbody></table>`;
        await start({checkAllTargetUser: true});
        const [first, second] = Array.from(document.querySelectorAll<HTMLInputElement>(".article_chkbox"));
        first!.closest("tr")!.insertAdjacentHTML("beforeend", writer);

        first!.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true, shiftKey: true}));
        expect(first!.checked).toBe(true);
        expect(second!.checked).toBe(true);
    });
});

describe("이미지 출처", () => {
    /** 디시 이미지 주소의 id: 올린 갤러리 아이디를 MD5("dcinside")와 XOR한 16진수 (baseball_new, test, mi$test). */
    const image = (id: string): string => `<img src="https://dcimg1.dcinside.com/viewimage.php?id=${id}&no=1">`;
    const origin = (): string | null | undefined => document.querySelector(".gallview_head > p")?.textContent;

    const mountView = (contents: string): void => {
        document.body.innerHTML = `<div class="gallview_head"><span class="title_subject">제목</span></div><div class="write_div">${contents}</div>`;
    };

    it("다른 갤러리에서 올린 이미지와 첨부 파일을 번호와 함께 알린다", async () => {
        mountView(image("2fbcc323e7d334aa51b1d3a2") + image("39b8c332") + image("2fbcc323e7d334aa51b1d3a2"));
        document.body.insertAdjacentHTML("beforeend", "<ul class=\"appending_file\"><li>baseball_new-20240101-123456-000.jpg</li></ul>");
        await start({imageOrigin: true});
        await tick();
        expect(origin()).toBe("다른 갤러리의 이미지: baseball_new(1번, 3번, 첨부 1번)");
    });

    it("이 갤러리와 같은 아이디의 미니 갤러리에서 올린 이미지는 알리지 않는다", async () => {
        mountView(image("39b8c332") + image("20b49432e0c12c"));
        await start({imageOrigin: true});
        await tick();
        expect(origin()).toBeUndefined();
    });
});

describe("같은 제목 찾기", () => {
    /** 디시 글 머리: 작성자 칸 안에 닉네임·날짜(.fl)와 조회·추천 수(.fr)가 있다. */
    const mountView = (): void => {
        document.body.innerHTML = "<div class=\"gallview_head\"><h3><span class=\"title_subject\">같은 제목</span></h3>" +
            "<div class=\"gall_writer\"><div class=\"fl\"><span class=\"nickname\">닉</span></div><div class=\"fr\"><span class=\"gall_count\">조회 1</span></div></div></div>";
    };
    const result = (title: string, id: string, no: string, gallery: string): string =>
        `<li><a class="tit_txt" href="https://gall.dcinside.com/board/view/?id=${id}&no=${no}">${title}</a><span class="sub_txt">${gallery}</span></li>`;

    it("조회 수 칸에 버튼을 달고, 제목이 똑같은 다른 글의 갤러리를 알린다", async () => {
        useUiStore.setState({toasts: []});
        searchPosts.mockResolvedValue(`<ul class="sch_result_list">${result("같은 제목", "a", "1", "갤A") + result("같은 제목 아님", "b", "2", "갤B") + result("같은 제목", "c", "3", "갤C")}</ul>`);
        mountView();
        await start({titleSearch: true});
        await tick();

        const button = document.querySelector<HTMLButtonElement>(".gall_writer .fr > button");
        expect(button?.textContent).toBe("같은 제목 찾기");
        button!.click();
        await vi.waitFor(() => expect(useUiStore.getState().toasts.map((toast) => toast.content)).toEqual(["제목이 같은 글 2개: 갤A, 갤C"]));
        expect(searchPosts).toHaveBeenCalledWith("같은 제목");
    });
});
