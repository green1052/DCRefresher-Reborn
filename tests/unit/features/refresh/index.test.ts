// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, describe, expect, it, onTestFinished, vi} from "vitest";

import {LIST_SELECTOR} from "@/core/list";
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

// 목록 비교 해시. jsdom의 crypto에는 subtle이 없고, WebCrypto는 가짜 타이머 밖에서 끝나 주기를 앞당겨도 기다리지 않는다.
// 같은 목록이면 같은 값만 주면 되므로 받은 글자를 그대로 돌려준다.
vi.mock("@/utils/hash", async (importOriginal) => ({...await importOriginal(), sha256: async (data: Uint8Array) => new TextDecoder().decode(data)}));

// 미리보기 모듈은 띄우지 않고 창이 열려 있는지만 바꿔 답한다.
const preview = vi.hoisted(() => ({open: false}));
vi.mock("@/core/module/registry", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/core/module/registry")>();
    return {
        ...actual,
        getModuleApi: ((id) => (id === "preview" ? {archiveArticle: () => false, isOpen: () => preview.open} : actual.getModuleApi(id))) as typeof actual.getModuleApi
    };
});

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

let running: Running<{ refreshLists(): Promise<void>; togglePause(): void; isPaused(): boolean; reload(): Promise<void>; catchUp(): void }> | undefined;

const start = async (patch = {}) => {
    running = await runModule(refresh, patch);
    return running;
};

beforeEach(() => {
    history.replaceState(null, "", "/board/lists/?id=test");
    document.body.innerHTML = page(["2", "1"]);
    useUiStore.setState({toasts: []});
    vi.spyOn(Math, "random").mockReturnValue(0);
    preview.open = false;
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

    it.each(["s_keyword=abc", "rf_ip=1.2"])("검색 중(%s)이면 처음부터 멈춘다", async (query) => {
        history.replaceState(null, "", `/board/lists/?id=test&${query}`);
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

    it("모듈을 끄면 남겨 둔 삭제된 글 행을 빼고 새 글 효과를 뗀다", async () => {
        const {stop} = await start();
        const [fresh, deleted] = document.querySelectorAll<HTMLElement>(".gall_list tbody > tr");
        fresh!.classList.add("refresherNewPost");
        fresh!.style.animationDelay = "50ms";
        deleted!.classList.add("refresherDeleted");
        stop();
        running = undefined;
        expect(listed()).toEqual(["2"]);
        expect(fresh!.classList.contains("refresherNewPost")).toBe(false);
        expect(fresh!.style.animationDelay).toBe("");
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

    it("관리자가 글을 고르는 중이면 갈아끼우지 않고 그렇다고 알린다", async () => {
        document.querySelector("tbody > tr")!.insertAdjacentHTML("afterbegin", "<td><input type=\"checkbox\" class=\"article_chkbox\" checked></td>");
        respond(["3", "2", "1"]);
        const {api} = await start();
        await api.refreshLists();
        expect(get).not.toHaveBeenCalled();
        expect(listed()).toEqual(["2", "1"]);
        expect(toasts().at(-1)).toBe("고른 글이나 열린 유저 메뉴가 있어 글 목록을 새로고침하지 않았습니다.");
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

    it("목록 위에서 쉬기를 켜면 커서가 목록에 있는 동안 받지 않고, 떠나면 다음 주기에 받는다", async () => {
        vi.useFakeTimers();
        respond(["2", "1"]);
        // jsdom은 커서가 없어 :hover만 목록 위에 있는 것으로 답한다.
        let hovered = true;
        const list = document.querySelector(LIST_SELECTOR)!;
        const matches = list.matches.bind(list);
        vi.spyOn(list, "matches").mockImplementation((selectors) => (selectors === ":hover" ? hovered : matches(selectors)));
        await start({pauseOnHover: true});
        await vi.advanceTimersByTimeAsync(20_000);
        expect(get).not.toHaveBeenCalled();

        hovered = false;
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(1);
    });

    // 응답을 2초 늦게 준다. 큰 갤러리는 목록 응답에 2~3초가 걸린다.
    const respondLate = (nos: string[]): void => {
        get.mockImplementation(() => new Promise((resolve) => {
            setTimeout(() => resolve(new Response(`<html><body>${page(nos)}</body></html>`)), 2000);
        }));
    };

    it("응답을 기다리는 동안 커서가 목록에 올라오면 받은 목록을 버리고, 떠나면 다음 주기에 갈아끼운다", async () => {
        vi.useFakeTimers();
        respondLate(["3", "2", "1"]);
        let hovered = false;
        const list = document.querySelector(LIST_SELECTOR)!;
        const matches = list.matches.bind(list);
        vi.spyOn(list, "matches").mockImplementation((selectors) => (selectors === ":hover" ? hovered : matches(selectors)));
        await start({pauseOnHover: true});
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(1);

        hovered = true;
        await vi.advanceTimersByTimeAsync(2000);
        expect(listed()).toEqual(["2", "1"]);

        hovered = false;
        await vi.advanceTimersByTimeAsync(7500);
        expect(get).toHaveBeenCalledTimes(2);
        expect(listed()).toEqual(["3", "2", "1"]);
    });

    it("응답을 기다리는 동안 관리자가 글을 고르면 체크를 지우지 않고, 풀면 다음 주기에 갈아끼운다", async () => {
        vi.useFakeTimers();
        respondLate(["3", "2", "1"]);
        await start();
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(1);

        document.querySelector("tbody > tr")!.insertAdjacentHTML("afterbegin", "<td><input type=\"checkbox\" class=\"article_chkbox\" checked></td>");
        const checkbox = document.querySelector<HTMLInputElement>(".article_chkbox")!;
        await vi.advanceTimersByTimeAsync(2000);
        expect(listed()).toEqual(["2", "1"]);
        expect(checkbox.isConnected).toBe(true);

        checkbox.checked = false;
        await vi.advanceTimersByTimeAsync(7500);
        expect(listed()).toEqual(["3", "2", "1"]);
    });

    it("미리보기 창이 열린 동안 받지 않다가 닫으면 곧바로 받는다", async () => {
        vi.useFakeTimers();
        // jsdom에는 없는 API. 새 글을 셀 때 부른다.
        Element.prototype.checkVisibility = () => true;
        respond(["3", "2", "1"]);
        preview.open = true;
        const {api} = await start();
        await vi.advanceTimersByTimeAsync(20_000);
        expect(get).not.toHaveBeenCalled();

        preview.open = false;
        api.catchUp();
        await vi.advanceTimersByTimeAsync(0);
        expect(listed()).toEqual(["3", "2", "1"]);
    });

    it("작성자 거르기 목록은 이어 붙인 행을 제자리에서 지우지 않고 tbody를 통째로 바꾼다", async () => {
        vi.useFakeTimers();
        history.replaceState(null, "", "/board/lists/?id=test&rf_ip=1.2");
        // 검색 모듈이 다음 쪽에서 이어 붙인 행. 새 tbody가 들어와야 검색 모듈이 다시 잇는다.
        const old = document.querySelector(".gall_list tbody")!;
        old.insertAdjacentHTML("beforeend", row("0"));
        respond(["2", "1"]);
        await start({noRefreshOnSearch: false});
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalled();
        expect(document.querySelector(".gall_list tbody")).not.toBe(old);
        expect(old.isConnected).toBe(false);
        expect(listed()).toEqual(["2", "1"]);
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
        // 새 글이 없어 다음 주기는 1.5배(7.5초 + 0.5초)다.
        await vi.advanceTimersByTimeAsync(8000);
        expect(get).toHaveBeenCalledTimes(2);
        expect(document.querySelector("tbody > tr")).toBe(first);
    });

    it("목록 표 태그를 못 찾으면 앞에 있는 다른 tbody로 비교하지 않는다", async () => {
        vi.useFakeTimers();
        // 속성 순서가 바뀌어 목록 표를 글자로 찾지 못하고, 그 앞에 다른 tbody가 있는 응답.
        const reordered = (nos: string[]): string =>
            "<table class=\"other\"><tbody><tr><td>광고</td></tr></tbody></table>" + page(nos).replace("<table class=\"gall_list\">", "<table summary=\"목록\" class=\"gall_list\">");
        get.mockImplementation(async () => new Response(reordered(["2", "1"])));
        await start();
        await vi.advanceTimersByTimeAsync(5500);
        get.mockImplementation(async () => new Response(reordered(["3", "2", "1"])));
        await vi.advanceTimersByTimeAsync(8000);
        expect(listed()).toEqual(["3", "2", "1"]);
    });

    it("새 글 없는 새로고침이 이어지면 주기를 0.5배씩 4배까지 늘리고, 새 글이 오면 되돌린다", async () => {
        vi.useFakeTimers();
        Element.prototype.checkVisibility = () => true;
        respond(["2", "1"]);
        await start();
        // 5 → 7.5 → 10 → 12.5 → 15 → 17.5 → 20 → 20초 (+0.5초)
        const gaps = [5500, 8000, 10_500, 13_000, 15_500, 18_000, 20_500, 20_500];
        for (const [index, gap] of gaps.entries()) {
            await vi.advanceTimersByTimeAsync(gap - 1);
            expect(get).toHaveBeenCalledTimes(index);
            await vi.advanceTimersByTimeAsync(1);
            expect(get).toHaveBeenCalledTimes(index + 1);
        }

        respond(["3", "2", "1"]);
        await vi.advanceTimersByTimeAsync(20_500);
        expect(listed()).toEqual(["3", "2", "1"]);
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(gaps.length + 2);
    });

    it("주기가 늘어난 동안 키를 누르면 원래 주기로 다시 잡는다", async () => {
        vi.useFakeTimers();
        respond(["2", "1"]);
        await start();
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(1);
        // 늘어난 주기라면 8초 뒤지만 키를 누른 때부터 5.5초 뒤에 받는다.
        await vi.advanceTimersByTimeAsync(1000);
        document.dispatchEvent(new KeyboardEvent("keydown", {key: "j"}));
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(2);
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

    it("탭으로 돌아와 곧바로 보낸 요청이 실패하면 다음 요청은 10.5초 뒤에 보낸다", async () => {
        vi.useFakeTimers();
        vi.spyOn(console, "error").mockImplementation(() => {});
        get.mockRejectedValue(new TypeError("Failed to fetch"));
        // jsdom에는 없는 API. 탭을 떠날 때 맨 위 글을 적느라 부른다.
        Element.prototype.checkVisibility = () => true;
        const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        await start();
        document.dispatchEvent(new Event("visibilitychange"));
        hidden.mockReturnValue(false);
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(0);
        expect(get).toHaveBeenCalledTimes(1);
        // 기본 주기(5.5초)가 아니라 두 배로 늘린 10초 + 0.5초 뒤다.
        await vi.advanceTimersByTimeAsync(10_499);
        expect(get).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(get).toHaveBeenCalledTimes(2);
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
        // 두 배로 늘어난 주기(10초 + 0.5초) 뒤에 받는다.
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
        // 교체 뒤 스크롤에서 던지면 목록은 바뀌어도 실패 토스트가 뜬다.
        expect(toasts()).toEqual([]);
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

describe("탭 제목 새 글 수·여기까지 읽음", () => {
    const marked = (): string[] => Array.from(document.querySelectorAll<HTMLElement>(".refresherReadMark"), (tr) => tr.dataset.no ?? "");

    it("떠난 동안 새 글이 들어왔으면 돌아올 때 떠날 때 맨 위 글에 선을 긋고, 목록을 갈아끼워도 다시 붙인다", async () => {
        // jsdom에는 없는 API. 행은 다 보이는 것으로 친다.
        Element.prototype.checkVisibility = () => true;
        document.title = "갤러리";
        const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
        const {api, stop} = await start();
        window.dispatchEvent(new Event("blur"));

        respond(["4", "3", "2", "1"]);
        await api.reload();
        await tick();
        expect(document.title).toBe("(2) 갤러리");

        focus.mockReturnValue(true);
        window.dispatchEvent(new Event("focus"));
        expect(document.title).toBe("갤러리");
        expect(marked()).toEqual(["2"]);
        // 돌아올 때 함께 오는 visibilitychange가 선을 지우지 않는다.
        document.dispatchEvent(new Event("visibilitychange"));
        expect(marked()).toEqual(["2"]);

        // 3이 지워져 목록을 통째로 갈아끼운다.
        respond(["5", "4", "2", "1"]);
        await api.reload();
        expect(marked()).toEqual(["2"]);

        // 새 글 없이 돌아오면 선을 지운다.
        focus.mockReturnValue(false);
        window.dispatchEvent(new Event("blur"));
        focus.mockReturnValue(true);
        window.dispatchEvent(new Event("focus"));
        expect(marked()).toEqual([]);

        stop();
        running = undefined;
    });

    it("숨긴 탭에서 돌아온 뒤 첫 로드에 새 글이 있으면 선을 긋는다", async () => {
        Element.prototype.checkVisibility = () => true;
        document.title = "갤러리";
        const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
        await start();
        document.dispatchEvent(new Event("visibilitychange"));

        // 숨은 탭은 새로고침을 쉬어 돌아오면서 받는다.
        respond(["4", "3", "2", "1"]);
        hidden.mockReturnValue(false);
        focus.mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.waitFor(() => expect(listed()).toEqual(["4", "3", "2", "1"]));
        await tick();
        expect(document.title).toBe("갤러리");
        expect(marked()).toEqual(["2"]);
    });

    it("실패가 쌓여 돌아오자마자 받지 않으면 다음 로드에 선을 긋는다", async () => {
        vi.useFakeTimers();
        vi.spyOn(console, "error").mockImplementation(() => {});
        Element.prototype.checkVisibility = () => true;
        get.mockRejectedValue(new TypeError("Failed to fetch"));
        const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
        const focus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
        await start();
        await vi.advanceTimersByTimeAsync(5500);
        expect(get).toHaveBeenCalledTimes(1);

        hidden.mockReturnValue(true);
        focus.mockReturnValue(false);
        document.dispatchEvent(new Event("visibilitychange"));
        respond(["4", "3", "2", "1"]);
        hidden.mockReturnValue(false);
        focus.mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(0);
        expect(get).toHaveBeenCalledTimes(1);
        expect(marked()).toEqual([]);

        // 늘어난 주기(10초 + 0.5초) 뒤에 받는다.
        await vi.advanceTimersByTimeAsync(10_500);
        expect(listed()).toEqual(["4", "3", "2", "1"]);
        // 새 글은 필터가 돈 뒤 한 차례 뒤에 센다.
        await vi.advanceTimersByTimeAsync(1);
        expect(marked()).toEqual(["2"]);
    });

    it("readMark를 끄면 탭 제목에는 세어도 선을 긋지 않는다", async () => {
        Element.prototype.checkVisibility = () => true;
        document.title = "갤러리";
        const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
        const {api} = await start({readMark: false});
        window.dispatchEvent(new Event("blur"));
        respond(["3", "2", "1"]);
        await api.reload();
        await tick();
        expect(document.title).toBe("(1) 갤러리");
        focus.mockReturnValue(true);
        window.dispatchEvent(new Event("focus"));
        expect(marked()).toEqual([]);
    });

    it("titleCount를 끄면 탭 제목은 그대로 두고 선은 긋는다", async () => {
        Element.prototype.checkVisibility = () => true;
        document.title = "갤러리";
        const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
        const {api} = await start({titleCount: false});
        window.dispatchEvent(new Event("blur"));
        respond(["3", "2", "1"]);
        await api.reload();
        await tick();
        expect(document.title).toBe("갤러리");
        focus.mockReturnValue(true);
        window.dispatchEvent(new Event("focus"));
        expect(marked()).toEqual(["2"]);
    });

    it("설정을 끄면 그 설정이 붙인 것만 뗀다", async () => {
        Element.prototype.checkVisibility = () => true;
        document.title = "갤러리";
        const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
        const {api, change} = await start();
        window.dispatchEvent(new Event("blur"));
        respond(["3", "2", "1"]);
        await api.reload();
        await tick();
        focus.mockReturnValue(true);
        window.dispatchEvent(new Event("focus"));
        expect(marked()).toEqual(["2"]);

        // 다시 떠나 제목에 수가 붙은 채로 선을 끈다.
        focus.mockReturnValue(false);
        window.dispatchEvent(new Event("blur"));
        respond(["4", "3", "2", "1"]);
        await api.reload();
        await tick();
        expect(document.title).toBe("(1) 갤러리");
        change({readMark: false});
        expect(marked()).toEqual([]);
        expect(document.title).toBe("(1) 갤러리");
        change({titleCount: false});
        expect(document.title).toBe("갤러리");
    });

    it("모듈을 끄면 선을 뗀다", async () => {
        Element.prototype.checkVisibility = () => true;
        const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
        const {api, stop} = await start();
        window.dispatchEvent(new Event("blur"));
        respond(["3", "2", "1"]);
        await api.reload();
        await tick();
        focus.mockReturnValue(true);
        window.dispatchEvent(new Event("focus"));
        expect(marked()).toEqual(["2"]);
        stop();
        running = undefined;
        expect(marked()).toEqual([]);
    });
});
