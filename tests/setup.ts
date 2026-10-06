/**
 * 단위 테스트 공통 준비 (vitest.config.ts의 setupFiles). 테스트 파일마다 먼저 돈다.
 * 목·스파이는 vitest.config.ts의 mockReset·restoreMocks가 테스트마다 되돌린다.
 * 아래 polyfill은 jsdom·fake-browser에만 없는 것이다. 확장이 도는 브라우저에는 다 있다.
 */
import {afterEach, beforeEach, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

beforeEach(() => fakeBrowser.reset());
// 가짜 타이머를 쓴 테스트가 실패로 끝나도 다음 테스트는 실제 타이머로 시작한다.
afterEach(() => void vi.useRealTimers());

// fake-browser의 getKeys는 구현되지 않았다고 던진다. reset이 바꾸지 않는 객체라 한 번만 채운다.
fakeBrowser.storage.local.getKeys = async () => Object.keys(await fakeBrowser.storage.local.get(null));

// Cookie Store API (core/http/cookie). 쿠키가 하나도 없는 것으로 둔다.
Object.assign(globalThis, {cookieStore: {get: async () => null}});

if (typeof window !== "undefined") {
    // core/http/urls가 불러올 때 내비게이션 기록을 읽는다.
    performance.getEntriesByType ??= () => [];
    // utils/sanitize가 style 속성을 for...of로 돈다.
    const style = CSSStyleDeclaration.prototype as unknown as Record<typeof Symbol.iterator, unknown>;
    style[Symbol.iterator] ??= function* (this: CSSStyleDeclaration) {
        for (let index = 0; index < this.length; index++) yield this.item(index);
    };
    // Web Locks (stores/modules·core/storage/sync). 한 탭뿐이므로 차례대로 잇기만 한다.
    if (!("locks" in navigator)) {
        let queue: Promise<unknown> = Promise.resolve();
        Object.defineProperty(navigator, "locks", {
            value: {
                request: (_name: string, callback: () => Promise<unknown>) => {
                    const result = queue.then(callback);
                    queue = result.catch(() => undefined);
                    return result;
                }
            }
        });
    }
}
