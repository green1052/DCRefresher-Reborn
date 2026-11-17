// 오버레이 CSS (components/overlay/styles.ts). 디시 페이지에 입히는 CSS는 entrypoints/page.content.css다.
import "@/components/overlay/styles";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "@/core/pages";

// 본문은 HTML 엔트리 덕에 청크로 나눠 런타임에 불러온다(옵션, 팝업과 공유) - 파이어폭스는 문서를 다시 읽은 뒤의 늦은 동적 import가 실패한다.
export default defineContentScript({
    matches: CONTENT_MATCHES,
    excludeMatches: CONTENT_EXCLUDE_MATCHES,
    runAt: "document_start",
    // WXT loadCss가 ENTRYPOINT(="html") 이름으로 CSS를 찾아 content.css를 못 얻으므로 manual - overlay.tsx가 직접 shadow에 넣는다.
    cssInjectionMode: "manual",
    // 새 인스턴스가 떴다는 알림을 페이지 창에 postMessage로 뿌리지 않는다 (이전 인스턴스 정리는 WXT가 CustomEvent로 한다).
    noScriptStartedPostMessage: true,
    async main(ctx) {
        // 개발 빌드는 HTML 엔트리가 디스크에 나오지 않으므로 번들 안에서 직접 쓴다.
        if (import.meta.env.DEV) {
            await (await import("./main")).start(ctx);
            return;
        }
        // getURL은 알려진 엔트리로 좁힌 타입이라 문자열로 넓히고, start는 main.ts가 전역에 심는다.
        await import(/* @vite-ignore */ (browser.runtime.getURL as (path: string) => string)("chunks/content-main.js"));
        const start = (globalThis as Record<string, unknown>)["__refresherContentStart"] as typeof import("./main")["start"] | undefined;
        if (!start) throw new Error("콘텐츠 본문 청크에서 start를 찾지 못했습니다.");
        await start(ctx);
    }
});
