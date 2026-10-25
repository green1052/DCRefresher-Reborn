// 오버레이 CSS (components/overlay/styles.ts). 디시 페이지에 입히는 CSS는 entrypoints/page.content.css다.
import "@/components/overlay/styles";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "@/core/pages";

/**
 * 얇은 부트스트랩. 본문(main.ts)은 content-main.html 덕에 ESM 청크(chunks/content-main.js)로 나와
 * 런타임에 불러온다 — IIFE에서는 동적 import가 인라인돼 미리보기 UI(react-dom·Base UI)가 페이지마다
 * 실리기 때문이다. WXT가 공식 지원하면(#357, v1.1) type: "module"로 이 걷는다. 수동 구현의 근거와
 * 예제는 문서(ES Modules·esm-content-script-ui). 비동기 로더라 run_at를 완전히는 못 지킨다.
 */
export default defineContentScript({
    matches: CONTENT_MATCHES,
    excludeMatches: CONTENT_EXCLUDE_MATCHES,
    runAt: "document_start",
    // CSS는 manifest가 아니라 오버레이를 처음 띄울 때 shadow에 넣는다. "manual"이면 WXT의 자동 읽기(ENTRYPOINT
    // 이름이 content-main이라 content.css를 못 찾는다)를 끄고 overlay.tsx가 직접 읽는다.
    cssInjectionMode: "manual",
    // 새 인스턴스가 떴다는 알림을 페이지 창에 postMessage로 뿌리지 않는다 (이전 인스턴스 정리는 WXT가 CustomEvent로 한다).
    noScriptStartedPostMessage: true,
    async main(ctx) {
        // 개발 빌드는 HTML 엔트리가 디스크에 나오지 않으므로 번들 안에서 직접 쓴다.
        if (import.meta.env.DEV) {
            await (await import("./main")).start(ctx);
            return;
        }
        // getURL은 WXT가 알려진 엔트리로 좁힌 타입이라 문자열로 넓혀 부른다. start는 main.ts가 전역에 심는 것
        // (export는 HTML 엔트리 빌드에서 트리쉐이킹된다).
        await import(/* @vite-ignore */ (browser.runtime.getURL as (path: string) => string)("chunks/content-main.js"));
        const start = (globalThis as Record<string, unknown>)["__refresherContentStart"] as typeof import("./main")["start"] | undefined;
        if (!start) throw new Error("콘텐츠 본문 청크에서 start를 찾지 못했습니다.");
        await start(ctx);
    }
});
