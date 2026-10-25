// 오버레이 CSS (components/overlay/styles.ts). 디시 페이지에 입히는 CSS는 entrypoints/page.content.css다.
import "@/components/overlay/styles";

import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "@/core/pages";

/**
 * 콘텐츠 스크립트 = 얇은 부트스트랩. 본문(main.ts)은 HTML 엔트리(content-main.html) 쪽에 ESM으로 나와
 * chunks/content-main.js로 나오고 여기서 런타임에 불러온다. IIFE 번들에서는 동적 import가 강제로 인라인돼
 * 미리보기 UI(react-dom·Base UI, 본문의 절반쯤)가 페이지마다 실리기 때문이다. ESM 청크에서는 main.ts와 그
 * 안의 동적 import(오버레이 UI)가 갈라져, UI는 오버레이를 처음 띄울 때만 읽힌다.
 *
 * WXT가 이 구조를 공식 지원하는 건 v1.1(이슈 #357, content-scripts/<이름>-loader.js + ESM 본문)이라 지금은
 * 문서(ES Modules)가 안내하는 수동 구현이다. 로더·CSS·vite:build:extendConfig 훅은 공식 예제
 * (wxt-dev/examples의 esm-content-script-ui)와 같은 모양이고, 예제와 달리 본문을 multipage(HTML) 그룹에
 * 얹어 옵션·팝업과 청크를 공유한다. v1.1이 나오면 이 부트스트랩을 걷고 type: "module"로 바꾼다.
 * 단, 비동기 로더라 run_at: document_start를 완전히 지키지 못한다(본문 시작이 페이지 파싱보다 늦을 수 있다).
 */
export default defineContentScript({
    matches: CONTENT_MATCHES,
    excludeMatches: CONTENT_EXCLUDE_MATCHES,
    runAt: "document_start",
    // CSS는 manifest가 아니라 오버레이를 처음 띄울 때 shadow에 넣는다. 오버레이를 띄우지 않는 페이지는 오버레이 CSS를 읽지 않는다.
    // "manual"을 쓰는 건 WXT의 createShadowRootUi 자동 읽기가 엔트리 이름(ENTRYPOINT)으로 파일을 찾는데 이 이름이
    // 이 청크에서는 content-main이라 content.css를 못 찾기 때문이다. overlay.tsx가 같은 규칙으로 직접 읽는다.
    cssInjectionMode: "manual",
    // 새 인스턴스가 떴다는 알림을 페이지 창에 postMessage로 뿌리지 않는다 (이전 인스턴스 정리는 WXT가 CustomEvent로 한다).
    noScriptStartedPostMessage: true,
    async main(ctx) {
        if (import.meta.env.DEV) {
            // 개발 빌드는 HTML 엔트리가 디스크에 나오지 않고 개발 서버가 읽으므로 예전처럼 이 번들 안에서 인라인으로 쓴다.
            const {start} = await import("./main");
            await start(ctx);
            return;
        }
        // getURL은 WXT가 알려진 엔트리 파일로 좁힌 타입이라 청크 경로는 문자열로 넓혀 부른다.
        const getURL = browser.runtime.getURL as (path: string) => string;
        // start는 main.ts가 모듈 꼭대기에서 격리 세계 전역에 심는 것을 쓴다 (export는 HTML 엔트리 빌드에서 트리셰이킹된다).
        await import(/* @vite-ignore */ getURL("chunks/content-main.js"));
        const start = (globalThis as Record<string, unknown>)["__refresherContentStart"] as typeof import("./main")["start"] | undefined;
        if (!start) throw new Error("콘텐츠 본문 청크에서 start를 찾지 못했습니다.");
        await start(ctx);
    }
});
