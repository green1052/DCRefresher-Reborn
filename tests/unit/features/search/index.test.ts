// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test&s_keyword=abc"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";

import search from "@/features/search/index";
import {useUiStore} from "@/stores/ui";

import {tick} from "../../../helpers";
import {type Running, runModule} from "../module";

const get = vi.hoisted(() => vi.fn<(url: string, options?: { signal?: AbortSignal }) => { text(): Promise<string> }>());
vi.mock("@/core/http/client", async (importOriginal) => ({...await importOriginal<typeof import("@/core/http/client")>(), http: {get}}));

const NEXT = (pos: number): string => `https://gall.dcinside.com/board/lists/?id=test&s_keyword=abc&search_pos=${pos}`;

const row = (no: string): string => `<tr class="ub-content" data-no="${no}"><td class="gall_tit"><a href="#${no}">abc ${no}</a></td></tr>`;
const commentRow = (no: string): string => `<tr class="search_comment" data-cmt="${no}"><td class="sch_cmt">댓글</td></tr>`;

/** 페이징: last면 현재 페이지 뒤에 다음 검색만 있고, 아니면 다음 페이지 링크가 있다. */
const paging = (next: number | null, last = true): string =>
    `<em>1</em>${last ? "" : "<a href=\"?page=2\">2</a>"}${next === null ? "" : `<a class="search_next" href="${NEXT(next)}">다음검색</a>`}`;

const listPage = (rows: string[], pagingHtml: string): string =>
    `<div class="left_content"><article><div class="gall_listwrap"><table class="gall_list"><tbody>${rows.join("")}</tbody></table></div>` +
    `<div class="bottom_paging_box">${pagingHtml}</div></article></div>`;

/** 다음 검색 주소마다 돌려줄 페이지. */
const pages = new Map<string, string>();

const listed = (): string[] => Array.from(document.querySelectorAll<HTMLElement>(".gall_list tbody > tr"), (tr) => tr.dataset.no ?? `c${tr.dataset.cmt}`);

let running: Running<void> | undefined;
const start = async (patch = {}) => (running = await runModule(search, patch));

beforeEach(() => {
    history.replaceState(null, "", "/board/lists/?id=test&s_keyword=abc");
    pages.clear();
    useUiStore.setState({toasts: []});
    get.mockImplementation((url) => ({text: async () => pages.get(url) ?? "<html><body>알림</body></html>"}));
    document.body.innerHTML = `<input id="sch_q" value="abc"><input id="list_num" value="4">${listPage([row("10")], paging(-100))}`;
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

it("검색 결과가 모자라면 다음 검색 결과를 이어 붙인다", async () => {
    pages.set(NEXT(-100), listPage([row("9"), commentRow("1")], paging(-200)));
    pages.set(NEXT(-200), listPage([row("8"), row("7"), row("6")], paging(-300)));
    await start();
    await vi.waitFor(() => expect(listed()).toEqual(["10", "9", "c1", "8", "7", "6"]));
    // 목표(4개)를 채우면 멈춘다. 댓글 행은 세지 않는다.
    expect(get).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".refresherSearchStatus")).toBeNull();
    expect(document.querySelector(".bottom_paging_box a.search_next")?.getAttribute("href")).toBe(NEXT(-300));
    expect(document.querySelector("tr[data-no='9'] .mark")?.textContent).toBe("abc");
});

it("최대 횟수까지만 잇는다", async () => {
    for (let pos = -100; pos >= -1000; pos -= 100) pages.set(NEXT(pos), listPage([], paging(pos - 100)));
    await start({maxSearches: 3});
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    await tick();
    expect(get).toHaveBeenCalledTimes(3);
});

it("받은 페이지가 구간의 마지막이 아니면 멈춘다", async () => {
    pages.set(NEXT(-100), listPage([row("9")], paging(-200, false)));
    await start();
    await vi.waitFor(() => expect(listed()).toEqual(["10", "9"]));
    await tick();
    expect(get).toHaveBeenCalledTimes(1);
});

it("구간의 중간 페이지에서는 잇지 않는다", async () => {
    document.querySelector(".bottom_paging_box")!.innerHTML = paging(-100, false);
    await start();
    await tick();
    expect(get).not.toHaveBeenCalled();
});

it("이미 찬 목록에서는 잇지 않는다", async () => {
    document.querySelector("tbody")!.innerHTML = [row("4"), row("3"), row("2"), row("1")].join("");
    await start();
    await tick();
    expect(get).not.toHaveBeenCalled();
});

it("목록을 갈아끼우면 다시 잇되 받은 페이지는 다시 요청하지 않는다", async () => {
    pages.set(NEXT(-100), listPage([row("9"), row("8"), row("7")], paging(-200)));
    await start();
    await vi.waitFor(() => expect(listed()).toHaveLength(4));

    // 새로고침 모듈이 목록과 페이징을 처음 모습으로 갈아끼운다.
    document.querySelector(".gall_list")!.innerHTML = `<tbody>${row("10")}</tbody>`;
    document.querySelector(".bottom_paging_box")!.innerHTML = paging(-100);
    await vi.waitFor(() => expect(listed()).toEqual(["10", "9", "8", "7"]));
    expect(get).toHaveBeenCalledTimes(1);
});

it("목록 없는 페이지면 알리고 캐시에 두지 않는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await start();
    await vi.waitFor(() => expect(useUiStore.getState().toasts.at(-1)?.content).toBe("다음 검색 결과를 불러오지 못했습니다."));
    expect(document.querySelector(".refresherSearchStatus")).toBeNull();

    pages.set(NEXT(-100), listPage([row("9"), row("8"), row("7")], paging(-200)));
    document.querySelector(".gall_list")!.innerHTML = `<tbody>${row("10")}</tbody>`;
    await vi.waitFor(() => expect(listed()).toEqual(["10", "9", "8", "7"]));
    expect(get).toHaveBeenCalledTimes(2);
});

it("검색 페이지가 아니면 아무것도 하지 않는다", async () => {
    history.replaceState(null, "", "/board/lists/?id=test");
    await start();
    await tick();
    expect(get).not.toHaveBeenCalled();
});
