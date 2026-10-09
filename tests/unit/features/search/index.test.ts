// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test&s_type=search_subject_memo&s_keyword=abc"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";

import search from "@/features/search/index";

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

let running: Running<void> | undefined;

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
