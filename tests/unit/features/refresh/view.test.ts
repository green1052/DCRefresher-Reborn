// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=1"}
import {expect, it, vi} from "vitest";

import refresh from "@/features/refresh/index";

import {runModule} from "../module";

const get = vi.hoisted(() => vi.fn<(url: string) => Promise<Response>>());
vi.mock("@/core/http/client", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/http/client")>(),
    http: {get: (url: string) => ({text: async () => (await get(url)).text()})}
}));
// 목록 비교 해시 (index.test.ts와 같은 까닭).
vi.mock("@/utils/hash", () => ({sha256: async (data: Uint8Array) => new TextDecoder().decode(data)}));

const LIST = "<table class=\"gall_list\"><tbody><tr class=\"ub-content\" data-no=\"1\"><td class=\"gall_tit\"><a>글 1</a></td></tr></tbody></table>";

it("글 보기 페이지는 목록이 화면 밖인 동안 받지 않다가 보이면 곧바로 받는다", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    get.mockImplementation(async () => new Response(`<html><body>${LIST}</body></html>`));
    document.body.innerHTML = LIST;
    // jsdom에는 IntersectionObserver가 없다. 목록 표에 건 콜백을 받아 두고 보이는지를 직접 알린다.
    let report: (visible: boolean) => void = () => {};
    vi.stubGlobal("IntersectionObserver", class {
        constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
            report = (visible) => callback([{isIntersecting: visible}]);
        }

        observe(): void {}

        disconnect(): void {}
    });

    const {stop} = await runModule(refresh);
    report(false);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(get).not.toHaveBeenCalled();

    report(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(1);
    // 받은 뒤엔 다시 원래 주기다.
    await vi.advanceTimersByTimeAsync(5500);
    expect(get).toHaveBeenCalledTimes(2);
    stop();
});
