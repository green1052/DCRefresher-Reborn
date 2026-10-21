// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test&s_type=search_subject_memo&s_keyword=abc"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";

import search from "@/features/search/index";
import type {SelectedUser} from "@/stores/ui";

import {type Running, runModule} from "../module";

const get = vi.hoisted(() => vi.fn<(url: string) => Promise<Response>>());
// 모듈은 ky처럼 http.get(...).text()로 본문을 읽는다.
vi.mock("@/core/http/client", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/http/client")>(),
    http: {get: (url: string) => ({text: async () => (await get(url)).text()})}
}));

/** 검색 결과 행. 관리자 목록에선 지금 페이지 행에만 체크박스 칸이 있다. */
const row = (no: string, checkbox = false): string =>
    `<tr class="ub-content" data-no="${no}">${checkbox ? `<td><input type="checkbox" class="article_chkbox" value="${no}"></td>` : ""}` +
    `<td class="gall_num">${no}</td><td class="gall_tit"><a href="/board/view/?id=test&no=${no}">abc ${no}</a></td></tr>`;

/** 구간의 마지막 페이지 페이징. pos가 있으면 그 구간으로 가는 다음 검색 링크를 둔다. */
const paging = (pos?: number): string =>
    `<em>1</em>${pos ? `<a class="search_next" href="/board/lists/?id=test&s_type=search_subject_memo&s_keyword=abc&search_pos=-${pos}">다음 검색</a>` : ""}`;

const page = (rows: string, pos?: number): string =>
    "<div class=\"left_content\"><article><div class=\"gall_listwrap\"><table class=\"gall_list\">" +
    `<thead><tr><th class="chkbox_th"></th><th>번호</th><th>제목</th></tr></thead><tbody>${rows}</tbody></table></div>` +
    `<div class="bottom_paging_box">${paging(pos)}</div></article></div>`;

const results = new Map([
    ["-10000", page(row("20") + row("19"), 20000)],
    ["-20000", page(row("10") + row("9"))]
]);

const nos = (list: Element): string[] => Array.from(list.children, (tr) => tr.getAttribute("data-no") ?? "");

let running: Running<{ searchUserPosts: (user: SelectedUser, by: "nick" | "identity") => void }> | undefined;

beforeEach(() => {
    document.body.innerHTML = `<input id="sch_q" value="abc">${page(row("30", true) + row("29", true), 10000)}`;
    get.mockImplementation(async (url) => new Response(results.get(new URL(url).searchParams.get("search_pos") ?? "")));
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

it("목록을 갈아끼우면 받아 둔 검색 페이지를 다시 받지 않고 같은 행을 잇는다", async () => {
    running = await runModule(search);
    const first = document.querySelector(".gall_list tbody")!;
    await vi.waitFor(() => expect(nos(first)).toEqual(["30", "29", "20", "19", "10", "9"]));
    expect(get).toHaveBeenCalledTimes(2);
    expect(Array.from(first.querySelectorAll<HTMLInputElement>(".article_chkbox"), (box) => box.value)).toEqual(["30", "29", "20", "19", "10", "9"]);
    expect(first.querySelectorAll(".gall_tit .mark")).toHaveLength(4);
    const filled = first.innerHTML;

    // 새로고침 모듈처럼 페이징을 처음 것으로 되돌리고 목록을 갈아끼운다.
    document.querySelector(".bottom_paging_box")!.innerHTML = paging(10000);
    const fresh = document.createElement("tbody");
    fresh.innerHTML = row("30", true) + row("29", true);
    first.replaceWith(fresh);

    await vi.waitFor(() => expect(fresh.innerHTML).toBe(filled));
    expect(get).toHaveBeenCalledTimes(2);
    // 캐시의 행을 옮기지 않고 복제해 붙였다.
    expect(first.innerHTML).toBe(filled);
});

it("모듈을 끄면 이어 붙인 행을 빼고 페이징을 되돌린다", async () => {
    running = await runModule(search);
    const list = document.querySelector(".gall_list tbody")!;
    await vi.waitFor(() => expect(nos(list)).toEqual(["30", "29", "20", "19", "10", "9"]));

    running.stop();
    running = undefined;
    expect(nos(list)).toEqual(["30", "29"]);
    expect(document.querySelector<HTMLAnchorElement>(".search_next")!.search).toContain("search_pos=-10000");
});

it("스크립트가 다시 주입되면 앞 인스턴스가 이어 붙인 목록을 그대로 두고, 끌 때 처음 페이징으로 되돌린다", async () => {
    const first = await runModule(search);
    const list = document.querySelector(".gall_list tbody")!;
    await vi.waitFor(() => expect(nos(list)).toEqual(["30", "29", "20", "19", "10", "9"]));

    // 확장 업데이트로 컨텍스트가 무효화되면(stopAll) revoke 없이 멈추고, 파이어폭스는 새 스크립트를 넣는다.
    first.abort();
    running = await runModule(search);
    await new Promise((resolve) => setTimeout(resolve));
    expect(nos(list)).toEqual(["30", "29", "20", "19", "10", "9"]);
    expect(get).toHaveBeenCalledTimes(2);

    running.stop();
    running = undefined;
    expect(nos(list)).toEqual(["30", "29"]);
    expect(document.querySelector<HTMLAnchorElement>(".search_next")!.search).toContain("search_pos=-10000");
});

it("결과가 없는 구간의 빈 표(empty)에 이으면 empty를 떼고, 모듈을 끄면 되돌린다", async () => {
    document.body.innerHTML = `<input id="sch_q" value="abc">${page("", 10000)}`;
    const table = document.querySelector(".gall_list")!;
    table.classList.add("empty");
    running = await runModule(search);
    const list = document.querySelector(".gall_list tbody")!;
    await vi.waitFor(() => expect(nos(list)).toEqual(["20", "19", "10", "9"]));
    expect(table.classList.contains("empty")).toBe(false);

    running.stop();
    running = undefined;
    expect(nos(list)).toEqual([]);
    expect(table.classList.contains("empty")).toBe(true);
});

it("작성자 거르기만 하는 목록은 갈아끼울 때마다 다음 쪽을 새로 받는다", async () => {
    // 다음 쪽은 새 글이 들어오면 밀린다. 받아 둔 옛 쪽으로 이으면 1쪽에서 밀려난 글이 사라진다.
    history.replaceState(null, "", "/board/lists/?id=test&rf_ip=1.2");
    try {
        const writerRow = (no: string): string => `<tr class="ub-content" data-no="${no}"><td class="ub-writer" data-ip="1.2"></td></tr>`;
        const list = (rows: string, current: number): string =>
            `<div class="left_content"><article><div class="gall_listwrap"><table class="gall_list"><tbody>${rows}</tbody></table></div>` +
            `<div class="bottom_paging_box"><em>${current}</em>${current === 1 ? "<a href=\"/board/lists/?id=test&page=2\">2</a>" : ""}</div></article></div>`;
        let second = writerRow("29");
        get.mockImplementation(async () => new Response(list(second, 2)));
        document.body.innerHTML = `<input id="list_num" value="2">${list(writerRow("30"), 1)}`;
        running = await runModule(search);
        await vi.waitFor(() => expect(nos(document.querySelector(".gall_list tbody")!)).toEqual(["30", "29"]));

        // 새 글이 들어와 29가 1쪽으로 오고 28이 2쪽으로 밀렸다. 새로고침 모듈처럼 페이징을 되돌리고 목록을 갈아끼운다.
        second = writerRow("28");
        document.querySelector(".bottom_paging_box")!.innerHTML = "<em>1</em><a href=\"/board/lists/?id=test&page=2\">2</a>";
        const fresh = document.createElement("tbody");
        fresh.innerHTML = writerRow("29");
        document.querySelector(".gall_list tbody")!.replaceWith(fresh);

        await vi.waitFor(() => expect(nos(fresh)).toEqual(["29", "28"]));
        expect(get).toHaveBeenCalledTimes(2);
    } finally {
        history.replaceState(null, "", "/board/lists/?id=test&s_type=search_subject_memo&s_keyword=abc");
    }
});

it("작성자 거르기 목록을 갈아끼워도 1쪽의 이 작성자 글이 그대로면 다음 쪽을 다시 받지 않고 이어 붙인 행을 옮겨 온다", async () => {
    history.replaceState(null, "", "/board/lists/?id=test&rf_ip=1.2");
    try {
        const writerRow = (no: string, ip = "1.2"): string => `<tr class="ub-content" data-no="${no}"><td class="ub-writer" data-ip="${ip}"></td></tr>`;
        const pagingHtml = "<em>1</em><a href=\"/board/lists/?id=test&page=2\">2</a>";
        get.mockImplementation(async () => new Response(
            `<div class="left_content"><article><div class="gall_listwrap"><table class="gall_list"><tbody>${writerRow("29")}${writerRow("28", "3.4")}</tbody></table></div>` +
            "<div class=\"bottom_paging_box\"><em>2</em></div></article></div>"));
        document.body.innerHTML = `<input id="list_num" value="2"><div class="left_content"><article><div class="gall_listwrap"><table class="gall_list"><tbody>${writerRow("30")}</tbody></table></div>` +
            `<div class="bottom_paging_box">${pagingHtml}</div></article></div>`;
        running = await runModule(search);
        const first = document.querySelector(".gall_list tbody")!;
        await vi.waitFor(() => expect(nos(first)).toEqual(["30", "29", "28"]));
        const added = first.children[1];

        // 다른 사람 글 31이 들어오고 28이 1쪽으로 올라왔다. 이 작성자 글(30)은 그대로다.
        document.querySelector(".bottom_paging_box")!.innerHTML = pagingHtml;
        const fresh = document.createElement("tbody");
        fresh.innerHTML = writerRow("31", "3.4") + writerRow("30") + writerRow("28", "3.4");
        first.replaceWith(fresh);

        await vi.waitFor(() => expect(nos(fresh)).toEqual(["31", "30", "28", "29"]));
        expect(get).toHaveBeenCalledTimes(1);
        expect(fresh.children[3]).toBe(added);
        expect(document.querySelector(".bottom_paging_box em")?.textContent).toBe("2");

        // 1분이 지나면 다음 쪽에서 지워진 글이 남지 않게 다시 받는다.
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
        document.querySelector(".bottom_paging_box")!.innerHTML = pagingHtml;
        const later = document.createElement("tbody");
        later.innerHTML = writerRow("30");
        fresh.replaceWith(later);
        await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        vi.restoreAllMocks();
    } finally {
        history.replaceState(null, "", "/board/lists/?id=test&s_type=search_subject_memo&s_keyword=abc");
    }
});
