/**
 * 단위 테스트 공통 준비. 파일마다 불린다 (vitest.config.ts의 setupFiles).
 * - 테스트마다 fake-browser(storage·alarms 등 인메모리 상태)를 비우고, 끝나면 실제 타이머로 돌린다
 *   (목·스파이는 vitest.config.ts의 mockReset·restoreMocks가 테스트마다 되돌리므로 파일에서 따로 풀지 않는다)
 * - jsdom·Node에 없는 브라우저 API를 채운다. 확장이 도는 브라우저(Chrome·Firefox 140 이상)에는 다 있는 것들이다.
 */
import {afterEach, beforeEach, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

beforeEach(() => {
    fakeBrowser.reset();
});

// 가짜 타이머를 쓴 테스트가 중간에 실패해도 다음 테스트는 실제 타이머로 시작한다.
afterEach(() => {
    vi.useRealTimers();
});

// fake-browser의 storage.local.getKeys는 던지기만 한다 (core/backup, stores/modules가 쓴다). reset이 지우지 않는 같은 객체라 한 번만 바꾼다.
fakeBrowser.storage.local.getKeys = async () => Object.keys(await fakeBrowser.storage.local.get(null));

// Node 22의 V8에는 Uint8Array의 base64·hex 변환이 없다 (core/ipdb, core/backup이 쓴다).
const bytes = Uint8Array.prototype as Uint8Array & { toBase64?: () => string; toHex?: () => string };
bytes.toBase64 ??= function (this: Uint8Array) {
    return Buffer.from(this).toString("base64");
};
bytes.toHex ??= function (this: Uint8Array) {
    return Buffer.from(this).toString("hex");
};
const typed = Uint8Array as typeof Uint8Array & { fromBase64?: (text: string) => Uint8Array };
typed.fromBase64 ??= (text) => new Uint8Array(Buffer.from(text, "base64"));

// Cookie Store API (core/http/cookie의 csrfBody). jsdom·Node에는 없다. 쿠키가 없는 것처럼 둔다.
(globalThis as { cookieStore?: unknown }).cookieStore ??= {get: async () => null};

// jsdom에 없는 것들. core/http/urls는 불러오는 순간 내비게이션 항목을 읽는다. node 환경(@vitest-environment node) 파일에는 DOM이 없다.
if (typeof window !== "undefined") {
    const perf = performance as Performance & { getEntriesByType?: Performance["getEntriesByType"] };
    perf.getEntriesByType ??= () => [];
    // jsdom의 CSSStyleDeclaration은 for...of로 돌 수 없다 (utils/sanitize의 keepFormatting).
    const style = CSSStyleDeclaration.prototype as unknown as { [Symbol.iterator]?: (this: CSSStyleDeclaration) => Iterator<string> };
    style[Symbol.iterator] ??= function* (this: CSSStyleDeclaration) {
        for (let index = 0; index < this.length; index++) yield this.item(index);
    };
}

// Web Locks API (stores/modules의 설정 쓰기 줄). jsdom·Node에는 없다. 테스트는 한 탭뿐이라 순서대로 잇기만 한다.
if (typeof navigator !== "undefined" && !("locks" in navigator)) {
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
