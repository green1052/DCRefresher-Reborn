// 이 스크립트가 불러오는 CSS는 오버레이 shadow에만 들어간다 (cssInjectionMode: "ui"). 페이지 CSS는 entrypoints/page.content.scss
import "@/assets/styles/overlay-radix.css";
import "@/assets/styles/overlay.scss";

import {overlay} from "@/components/overlay/shadow";
import {initDatabase} from "@/core/database";
import {setBlockedHandler} from "@/core/http/client";
import {documentUrl} from "@/core/http/urls";
import {BLOCKED_PAGE_MESSAGE, BOARD_PAGE, CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES, WRITE_PAGE} from "@/core/pages";
import {onMessage} from "@/core/messaging/protocol";
import {loadAll, pageToggleStates, runPageToggle, runShortcut, stopAll} from "@/core/module/registry";
import features from "@/features";
import {needsPreviewOverlay, usePreviewStore} from "@/features/preview/ui/previewStore";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {useUiStore} from "@/stores/ui";
import {followDcAppearance} from "@/utils/appearance";
import {whenDomReady} from "@/utils/dom";

export default defineContentScript({
    matches: CONTENT_MATCHES,
    excludeMatches: CONTENT_EXCLUDE_MATCHES,
    runAt: "document_start",
    // CSS는 manifest가 아니라 오버레이를 처음 띄울 때 shadow에 넣는다. 오버레이를 띄우지 않는 페이지는 오버레이 CSS를 읽지 않는다
    cssInjectionMode: "ui",
    // 새 인스턴스가 떴다는 알림을 페이지 창에 postMessage로 뿌리지 않는다 (이전 인스턴스 정리는 WXT가 CustomEvent로 한다)
    noScriptStartedPostMessage: true,
    async main(ctx) {
        // 파이어폭스는 확장을 업데이트하거나 다시 켤 때 이전 스크립트를 정리 없이 없애고 새로 주입한다.
        // 죽은 인스턴스가 남긴 오버레이와 스크롤·클릭 잠금을 걷어 낸다.
        const stale = document.querySelector("refresher-root");
        if (stale) {
            stale.remove();
            const {documentElement: html, body} = document;
            // 미리보기 창은 <html> 스크롤과 뒤 페이지(inert)를, Radix 다이얼로그는 <body> 스크롤·바깥 클릭을 잠근다
            if (html.style.overflow === "hidden") {
                html.style.overflow = "";
                for (const element of body.querySelectorAll<HTMLElement>(":scope > [inert]")) element.inert = false;
            }
            if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
            body.removeAttribute("data-scroll-locked");
        }

        // ===== 메시징 (배경·팝업→탭) =====
        onMessage("refresher:executeShortcut", ({data: command}) => runShortcut(command));

        onMessage("refresher:pageState", pageToggleStates);
        onMessage("refresher:pageAction", ({data: action}) => {
            runPageToggle(action);
            return pageToggleStates();
        });

        // 확장을 끄거나 업데이트해도 이 스크립트는 남아 새로고침 폴링·저장소 호출을 하다 실패하므로 모듈을 멈춘다.
        // 부트스트랩의 await보다 먼저 건다. 읽는 사이 무효화되면 저장소 호출이 실패하거나 끝나지 않아 뒤에 건 처리는 걸리지 않는다
        ctx.onInvalidated(() => {
            stopAll();
            // 새 스크립트가 주입되어 무효화된 경우(확장은 살아 있음)는 새 스크립트가 이어서 돌므로 알리지 않는다
            if (browser.runtime?.id) return;
            // 기능이 조용히 멈추면 이유를 알 수 없으므로 알린다. WXT가 무효화 때 오버레이를 걷어 내므로 토스트 대신 DOM에 직접 띄운다.
            // manifest CSS도 확장과 함께 빠질 수 있어 인라인 스타일을 쓴다. 누르면 닫힌다
            const note = document.createElement("div");
            note.setAttribute("role", "status");
            // 업데이트·다시 불러오기·끄기·삭제 모두 여기로 온다. 글쓰기 페이지에서 바로 새로고침하면 작성 중인 글을 잃는다
            note.textContent = `확장 프로그램이 업데이트되었거나 꺼져서 이 페이지에서는 멈췄습니다. ${
                WRITE_PAGE.test(documentUrl.href) ? "작성 중인 글은 등록한 뒤 새로고침해 주세요." : "새로고침해 주세요."
            }`;
            note.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 14px;border-radius:8px;background:#333;color:#fff;font-size:13px;cursor:pointer";
            note.addEventListener("click", () => note.remove());
            document.body?.append(note);
        });
        // ponytail: WXT는 ctx.isValid를 읽을 때만 무효화를 알아채므로 빈 interval로 5초마다 검사하게 한다.
        // 업데이트 전에 열린 탭은 새로고침할 때까지 기능이 멈춘다.
        ctx.setInterval(() => {}, 5_000);

        // 옵션 페이지는 저장소에 직접 쓰고, 모듈 레지스트리가 저장소를 감시해 반영한다 (메시징 없음)

        // ===== 오버레이 (디시 CSS와 Radix Themes CSS가 섞이지 않게 shadow DOM에 둔다) =====
        let stopAppearance: (() => void) | undefined;
        const mountOverlay = async (): Promise<void> => {
            if (ctx.isInvalid) return;

            // react-dom·Radix·오버레이 UI는 오버레이를 처음 띄울 때 초기화한다. 번들 안에 있어 네트워크 요청은 없다
            const [{createRoot}, {ContentRoot}] = await Promise.all([
                import("react-dom/client"),
                import("@/components/overlay/ContentRoot")
            ]);

            const ui = await createShadowRootUi(ctx, {
                name: "refresher-root",
                position: "inline",
                anchor: "body",
                // WXT 기본 리셋(:host{all:initial !important})은 pointer-events까지 되돌려 페이지 클릭을 막는다.
                // 그래서 끄고 overlay.scss의 :host 리셋을 쓴다.
                inheritStyles: true,
                // 위에서 불러온 CSS는 WXT가 content-scripts/content.css로 묶어 두었다가 여기서 shadow에 넣는다 (:root → :host 포함)
                onMount(container) {
                    // 디시 다크모드를 따라간다. Radix는 조상의 light/dark 클래스로 색을 바꾸므로 오버레이 최상위 요소(app·portal의 부모)에 붙인다
                    stopAppearance = followDcAppearance(container);
                    const app = document.createElement("div");
                    const portal = document.createElement("div");
                    portal.id = "portal";
                    container.append(app, portal);

                    overlay.portal = portal;

                    const root = createRoot(app);
                    root.render(<ContentRoot/>);
                    return root;
                },
                onRemove: (root) => {
                    stopAppearance?.();
                    root?.unmount();
                }
            });
            // 무효화가 CSS를 받는 동안 일어났다면 WXT의 onInvalidated(remove)는 이미 끝난 signal에 걸려 불리지 않는다
            if (ctx.isInvalid) return;
            ui.mount();
        };

        // 대부분의 페이지는 오버레이를 끝내 띄우지 않으므로 CSS 처리·shadow 삽입·첫 렌더(수십 ms)를 처음 필요할 때로 미룬다.
        // 오버레이에 새 UI를 추가하면 그 표시 조건을 여기(미리보기 UI는 previewStore의 needsPreviewOverlay)에도 넣어야 한다. 빠지면 그 UI는 뜨지 않는다.
        // 매 페이지 setup이 채우는 값(badgeColors·ratios·blockView·selected·훅 등)은 넣지 않는다. 넣으면 항상 마운트된다.
        const needsOverlay = (): boolean => {
            const {toast, bubble, memo} = useUiStore.getState();
            return Boolean(toast || bubble || memo) || needsPreviewOverlay(usePreviewStore.getState());
        };

        const mountWhenNeeded = (): void => {
            if (!needsOverlay()) return;
            offUi();
            offPreview();
            whenDomReady(() => void mountOverlay());
        };
        const offUi = useUiStore.subscribe(mountWhenNeeded);
        const offPreview = usePreviewStore.subscribe(mountWhenNeeded);

        // ===== 모듈 부트스트랩 =====
        // 차단·메모·IP DB는 글 목록·본문(features의 urls와 같은 BOARD_PAGE)에서만 쓴다. 메인·검색 등에서는 저장소를 읽지 않는다.
        // 임시 차단을 먹으면 디시는 모든 요청에 빈 페이지를 준다(상태 코드는 200). 확장이 고장 난 것처럼 보이므로 이유를 알린다.
        // 막혀 있는 동안 요청마다 오므로 1분에 한 번만 띄운다
        let blockedWarnedAt = 0;
        const warnBlocked = (): void => {
            if (Date.now() - blockedWarnedAt < 60_000) return;
            blockedWarnedAt = Date.now();
            useUiStore.getState().showToast(BLOCKED_PAGE_MESSAGE, "warning", 0);
        };
        setBlockedHandler(warnBlocked);
        // 지금 페이지 자체가 빈 페이지인 경우
        const warnIfBlocked = (): void => {
            const content = Array.from(document.body?.children ?? []).filter((element) => element.tagName !== "REFRESHER-ROOT");
            if (content.length === 0 && !document.body?.textContent?.trim()) warnBlocked();
        };
        whenDomReady(warnIfBlocked);

        const board = BOARD_PAGE.test(documentUrl.href);
        await loadAll(features, ctx.signal, board ? Promise.all([initBlocksStore(ctx.signal), initMemosStore(ctx.signal)]) : undefined);
        // 저장소는 요청 순서대로 읽히므로 가장 큰 IP/밴 DB는 모듈 설정 뒤에 요청한다(userinfo는 setup에서 기다린다).
        // userinfo가 꺼져 있어도 버블·미리보기 라벨이 나오도록 여기서도 부른다.
        if (board) void initDatabase().catch(console.error);
    }
});
