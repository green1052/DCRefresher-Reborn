// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=7"}
import {afterEach, expect, it, vi} from "vitest";

import preview from "@/features/preview/index";

import {type Running, runModule} from "../module";

let running: Running<unknown> | undefined;

afterEach(() => {
    running?.stop();
    running = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const POST = "https://gall.dcinside.com/board/view/?id=test&no=7";
const LIST = "https://gall.dcinside.com/board/lists/?id=test";

/** 이전 문서의 미리보기가 쌓은 항목을 둔 채, 앞/뒤로 가기로 불러온 글 페이지에서 미리보기를 켠다. */
const enableOnBackForward = async (readyState: DocumentReadyState): Promise<void> => {
    vi.stubGlobal("matchMedia", () => ({matches: false}));
    // jsdom에는 탐색 종류가 없다. back_forward로 불러온 문서처럼 꾸민다.
    class FakeNavigation {
        type = "back_forward";
    }
    vi.stubGlobal("PerformanceNavigationTiming", FakeNavigation);
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([new FakeNavigation()] as unknown as PerformanceEntryList);
    vi.spyOn(document, "readyState", "get").mockReturnValue(readyState);

    const preData = {gallery: "test", id: "7", title: "t", link: POST, notice: false, recommend: false, type: "icon_txt", commentCount: 0};
    history.replaceState({refresher: 1, doc: 1, preData, back: {title: "목록", url: LIST, state: null}, depth: 1}, "", POST);
    running = await runModule(preview);
};

it("불러오는 중이면 목록으로 옮겨 미리보기를 다시 열게 한다", async () => {
    await enableOnBackForward("interactive");
    expect(location.href).toBe(LIST);
    expect(history.state).toMatchObject({reopen: true});
});

it("다 불러온 글 페이지에서 나중에 켜면 그대로 두고 미리보기 표시만 지운다", async () => {
    await enableOnBackForward("complete");
    expect(location.href).toBe(POST);
    expect(history.state).toBeNull();
});
