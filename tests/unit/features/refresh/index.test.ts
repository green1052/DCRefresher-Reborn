// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, describe, expect, it, onTestFinished, vi} from "vitest";

import refresh from "@/features/refresh/index";
import {useUiStore} from "@/stores/ui";

import {tick} from "../../../helpers";
import {type Running, runModule} from "../module";

type GetOptions = { signal?: AbortSignal; retry?: number; totalTimeout?: number };
const get = vi.hoisted(() => vi.fn<(url: string, options?: GetOptions) => Promise<Response>>());
// 모듈은 ky처럼 http.get(...).text()로 본문을 읽는다.
vi.mock("@/core/http/client", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/http/client")>(),
    http: {get: (url: string, options?: GetOptions) => ({text: async () => (await get(url, options)).text()})}
}));

const row = (no: string): string => `<tr class="ub-content" data-no="${no}"><td class="gall_num">${no}</td><td class="gall_tit"><a href="/board/view/?id=test&no=${no}">글 ${no}</a></td></tr>`;

const page = (nos: string[], current = 1): string =>
    "<div class=\"page_head\"><div class=\"gall_issuebox\"></div></div>" +
    "<div class=\"left_content\"><article><div class=\"gall_listwrap\">" +
    `<table class="gall_list"><tbody>${nos.map(row).join("")}</tbody></table></div>` +
    `<div class="bottom_paging_box"><em>${current}</em><a href="/board/lists/?id=test&page=${current + 1}">${current + 1}</a></div></article></div>`;

const listed = (): string[] => Array.from(document.querySelectorAll<HTMLElement>(".gall_list tbody > tr"), (tr) => tr.dataset.no ?? "");

const respond = (nos: string[], current = 1): void => {
    get.mockImplementation(async () => new Response(`<html><body>${page(nos, current)}</body></html>`));
};

let running: Running<{ refreshLists(): Promise<void>; togglePause(): void; isPaused(): boolean; reload(): Promise<void> }> | undefined;

const start = async (patch = {}) => {
    running = await runModule(refresh, patch);
    return running;
};

beforeEach(() => {
    history.replaceState(null, "", "/board/lists/?id=test");
    document.body.innerHTML = page(["2", "1"]);
    useUiStore.setState({toasts: []});
    vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

const toasts = (): string[] => useUiStore.getState().toasts.map((toast) => toast.content);

describe("제어 버튼·일시정지", () => {
    it("버튼으로 자동 새로고침을 멈추고 다시 켠다", async () => {
        const {api} = await start();
        const button = document.querySelector<HTMLButtonElement>(".gall_issuebox button[data-refresher-refresh]")!;
        expect(button.textContent).toBe("자동 새로고침: 켜짐");
        button.click();
        expect(api.isPaused()).toBe(true);
        expect(button.textContent).toBe("자동 새로고침: 꺼짐");

        api.togglePause();
        expect(api.isPaused()).toBe(false);
        expect(toasts().at(-1)).toContain("다시 켰습니다");
    });

    it("죽은 인스턴스가 남긴 버튼은 갈아끼운다", async () => {
        document.querySelector(".gall_issuebox")!.innerHTML = "<button data-refresher-refresh=\"true\">옛 버튼</button>";
        await start();
        const buttons = document.querySelectorAll(".gall_issuebox button");
        expect(buttons).toHaveLength(1);
        expect(buttons[0]?.textContent).toBe("자동 새로고침: 켜짐");
    });

    it("검색 중이면 처음부터 멈춘다", async () => {
        history.replaceState(null, "", "/board/lists/?id=test&s_keyword=abc");
        const {api, change} = await start();
        expect(api.isPaused()).toBe(true);
        change({noRefreshOnSearch: false});
        expect(api.isPaused()).toBe(false);
    });

    it("모듈을 끄면 버튼과 방문 색 클래스를 뗀다", async () => {
        const {change, stop} = await start({doNotColorVisited: true});
        expect(document.documentElement.classList.contains("refresherDoNotColorVisited")).toBe(true);
        change({doNotColorVisited: false});
        expect(document.documentElement.classList.contains("refresherDoNotColorVisited")).toBe(false);
        change({doNotColorVisited: true});
        stop();
        running = undefined;
        expect(document.documentElement.classList.contains("refresherDoNotColorVisited")).toBe(false);
        expect(document.querySelector("button[data-refresher-refresh]")).toBeNull();
    });
});

describe("직접 새로고침", () => {
    it("목록을 받아 갈아끼운다", async () => {
        respond(["3", "2", "1"]);
        const {api} = await start();
        await api.refreshLists();
        expect(get).toHaveBeenCalledWith("https://gall.dcinside.com/board/lists?id=test", expect.objectContaining({signal: expect.any(AbortSignal)}));
        expect(listed()).toEqual(["3", "2", "1"]);
    });

    it("멈춰 있어도 받는다", async () => {
        respond(["3", "2", "1"]);
        const {api} = await start();
        api.togglePause();
        await api.refreshLists();
        expect(listed()).toEqual(["3", "2", "1"]);
    });

    it("곧바로 다시 누르면 기다리라고 알린다", async () => {
        respond(["2", "1"]);
        const {api} = await start();
        await api.refreshLists();
        await api.refreshLists();
        expect(get).toHaveBeenCalledTimes(1);
        expect(toasts().at(-1)).toBe("잠시 후 다시 새로고침해 주세요.");
    });

    it("실패하면 알리고 목록은 그대로 둔다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        get.mockRejectedValue(new TypeError("Failed to fetch"));
        const {api} = await start();
        await api.refreshLists();
        expect(toasts().at(-1)).toBe("글 목록을 불러오지 못했습니다.");
        expect(listed()).toEqual(["2", "1"]);
    });

    it("목록 없는 응답도 실패다", async () => {
        get.mockImplementation(async () => new Response("<html><body>차단</body></html>"));
        const {api} = await start();
        await api.refreshLists();
        expect(toasts().at(-1)).toBe("글 목록을 불러오지 못했습니다.");
    });
});

describe("자동 새로고침", () => {
    it("주기마다 재시도 없이 받는다", async () => {
        vi.useFakeTimers();
        respond(["3", "2", "1"]);
        await start();
        await vi.advanceTimersByTimeAsync(5499);
        expect(get).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({retry: 0}));
        expect(listed()).toEqual(["3", "2", "1"]);
    });

    it("멈춰 있으면 받지 않는다", async () => {
        vi.useFakeTimers();
        respond(["2", "1"]);
        const {api} = await start();
        api.togglePause();
        await vi.advanceTimersByTimeAsync(20_000);
        expect(get).not.toHaveBeenCalled();
    });

    it("뒤 페이지는 받지 않는다", async () => {
        vi.useFakeTimers();
        history.replaceState(null, "", "/board/lists/?id=test&page=2");
        respond(["2", "1"]);
        await start();
        await vi.advanceTimersByTimeAsync(20_000);
        expect(get).not.toHaveBeenCalled();
    });

    it("관리자가 글을 고르는 중이면 갈아끼우지 않는다", async () => {
        vi.useFakeTimers();
        document.querySelector("tbody > tr")!.insertAdjacentHTML("afterbegin", "<td><input type=\"checkbox\" class=\"article_chkbox\" checked></td>");
        respond(["3", "2", "1"]);
        await start();
        await vi.advanceTimersByTimeAsync(20_000);
        expect(get).not.toHaveBeenCalled();
    });

    it("받은 목록이 그대로면 갈아끼우지 않는다", async () => {
        vi.useFakeTimers();
        respond(["2", "1"]);
        await start();
        await vi.advanceTimersByTimeAsync(5500);
        const first = document.querySelector("tbody > tr");
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(2);
        expect(document.querySelector("tbody > tr")).toBe(first);
    });

    it("연달아 실패하면 주기를 두 배로 늘리고 알리지 않는다", async () => {
        vi.useFakeTimers();
        vi.spyOn(console, "error").mockImplementation(() => {});
        get.mockRejectedValue(new TypeError("Failed to fetch"));
        await start();
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(1);
        // 다음은 10초 + 0.5초 뒤다.
        await vi.advanceTimersByTimeAsync(10_499);
        expect(get).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(get).toHaveBeenCalledTimes(2);
        expect(toasts()).toEqual([]);
    });

    it("응답이 멈추면 30초에 끊고 실패로 쳐서 다음 주기에 다시 받는다", async () => {
        vi.useFakeTimers();
        vi.spyOn(console, "error").mockImplementation(() => {});
        // 응답이 오지 않으면 ky가 totalTimeout에 TimeoutError로 끊는다.
        get.mockImplementation((_, options) => new Promise((_, reject) => {
            setTimeout(() => reject(new DOMException("", "TimeoutError")), options?.totalTimeout);
        }));
        await start();
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(30_000);
        // 실패로 쳐서 주기를 두 배(10초)로 늘려 다시 받는다.
        await vi.advanceTimersByTimeAsync(10_500);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("모듈을 끄면 더 받지 않는다", async () => {
        vi.useFakeTimers();
        respond(["2", "1"]);
        const {stop} = await start();
        stop();
        running = undefined;
        await vi.advanceTimersByTimeAsync(20_000);
        expect(get).not.toHaveBeenCalled();
    });
});

describe("페이지 이동 시 목록만 교체", () => {
    it("페이지 링크를 누르면 주소를 쌓고 그 목록을 받는다", async () => {
        respond(["8", "7"], 2);
        await start();
        const link = document.querySelector<HTMLAnchorElement>(".bottom_paging_box a")!;
        const click = new MouseEvent("click", {bubbles: true, cancelable: true, button: 0});
        link.dispatchEvent(click);
        await vi.waitFor(() => expect(listed()).toEqual(["8", "7"]));

        expect(click.defaultPrevented).toBe(true);
        expect(location.search).toBe("?id=test&page=2");
        expect(get).toHaveBeenCalledWith("https://gall.dcinside.com/board/lists?id=test&page=2", expect.anything());
        expect(document.querySelector(".bottom_paging_box em")?.textContent).toBe("2");
    });

    it("수정키 클릭이나 설정을 끈 경우는 가로채지 않는다", async () => {
        respond(["8", "7"], 2);
        await start({useBetterBrowse: false});
        // 모듈 리스너 뒤에 돌아 가로챘는지 적고, jsdom이 실제로 이동하지 않게 막는다.
        const prevented: boolean[] = [];
        const listeners = new AbortController();
        document.addEventListener("click", (ev) => {
            prevented.push(ev.defaultPrevented);
            ev.preventDefault();
        }, {signal: listeners.signal});
        onTestFinished(() => listeners.abort());
        const link = document.querySelector<HTMLAnchorElement>(".bottom_paging_box a")!;
        link.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true}));

        running!.change({useBetterBrowse: true});
        link.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true, ctrlKey: true}));
        expect(prevented).toEqual([false, false]);
        await tick();
        expect(get).not.toHaveBeenCalled();
    });

    it("뒤로 가기로 다른 목록 주소가 되면 그 목록을 받는다", async () => {
        respond(["8", "7"], 2);
        await start();
        history.replaceState(null, "", "/board/lists/?id=test&page=2");
        window.dispatchEvent(new PopStateEvent("popstate"));
        await vi.waitFor(() => expect(listed()).toEqual(["8", "7"]));
    });

    it("같은 목록 주소로 돌아온 것은 받지 않는다", async () => {
        await start();
        history.replaceState(null, "", "/board/lists/?id=test&no=5");
        window.dispatchEvent(new PopStateEvent("popstate"));
        await tick();
        expect(get).not.toHaveBeenCalled();
    });
});
