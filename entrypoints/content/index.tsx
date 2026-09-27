import "@/assets/styles/content.scss";
import "@/assets/styles/stealth.scss";
import "@/assets/styles/layout.scss";

import radixCss from "@/assets/styles/radix-themes.css?inline";
import {createRoot} from "react-dom/client";

import overlayCss from "@/assets/styles/overlay.scss?inline";
import {ContentRoot} from "@/components/overlay/ContentRoot";
import {overlay} from "@/components/overlay/shadow";
import {initDatabase} from "@/core/database";
import {setBlockedHandler} from "@/core/http/client";
import {BLOCKED_PAGE_MESSAGE, BOARD_PAGE} from "@/core/pages";
import {onMessage} from "@/core/messaging/protocol";
import {loadAll, pageToggleStates, runPageToggle, runShortcut, stopAll} from "@/core/module/registry";
import features from "@/features";
import {needsPreviewOverlay, usePreviewStore} from "@/features/preview/ui/previewStore";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {useUiStore} from "@/stores/ui";
import {whenDomReady} from "@/utils/dom";

export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*",
        "https://gallog.dcinside.com/*",
        // 이미지 팝업(viewimagePop.php)은 원래 gall 탭과 같은 렌더러에서 돌아 번들 평가·저장소 읽기 비용이 그 탭에 그대로 더해진다.
        // 로그인 페이지(sign)는 제외해도 폰트만 빠진다.
        "https://image.dcinside.com/*",
        "https://sign.dcinside.com/*"
    ],
    runAt: "document_start",
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

        // 옵션 페이지는 저장소에 직접 쓰고, 모듈 레지스트리가 저장소를 감시해 반영한다 (메시징 없음)

        // ===== 오버레이 (디시 CSS와 Radix Themes CSS가 섞이지 않게 shadow DOM에 둔다) =====
        // 페이지용 CSS(위 import)는 manifest로 주입하고, 오버레이 CSS만 css 옵션으로 shadow에 넣는다
        const mountOverlay = async (): Promise<void> => {
            if (ctx.isInvalid) return;

            const ui = await createShadowRootUi(ctx, {
                name: "refresher-root",
                position: "inline",
                anchor: "body",
                // WXT 기본 리셋(:host{all:initial !important})은 pointer-events까지 되돌려 페이지 클릭을 막는다.
                // 그래서 끄고 overlay.scss의 :host 리셋을 쓴다.
                inheritStyles: true,
                // Radix 토큰의 :root는 빌드 때 :host로 바뀌어 있다 (wxt.config.ts의 slim-overlay-radix)
                css: radixCss + overlayCss,
                onMount(container) {
                    const app = document.createElement("div");
                    const portal = document.createElement("div");
                    portal.id = "portal";
                    container.append(app, portal);

                    overlay.portal = portal;

                    const root = createRoot(app);
                    root.render(<ContentRoot/>);
                    return root;
                },
                onRemove: (root) => root?.unmount()
            });
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

        const board = BOARD_PAGE.test(location.href);
        if (board) await Promise.all([initBlocksStore(), initMemosStore()]);
        await loadAll(features);
        // 저장소는 요청 순서대로 읽히므로 가장 큰 IP/밴 DB는 모듈 설정 뒤에 요청한다(userinfo는 setup에서 기다린다).
        // userinfo가 꺼져 있어도 버블·미리보기 라벨이 나오도록 여기서도 부른다.
        if (board) void initDatabase().catch(console.error);

        // 확장을 끄거나 업데이트해도 이 스크립트는 남아 새로고침 폴링·저장소 호출을 하다 실패하므로 모듈을 멈춘다
        ctx.onInvalidated(() => {
            stopAll();
            // 새 스크립트가 주입되어 무효화된 경우(확장은 살아 있음)는 새 스크립트가 이어서 돌므로 알리지 않는다
            if (browser.runtime?.id) return;
            // 기능이 조용히 멈추면 이유를 알 수 없으므로 알린다. WXT가 무효화 때 오버레이를 걷어 내므로 토스트 대신 DOM에 직접 띄운다.
            // manifest CSS도 확장과 함께 빠질 수 있어 인라인 스타일을 쓴다. 누르면 닫힌다
            const note = document.createElement("div");
            note.setAttribute("role", "status");
            note.textContent = "확장 프로그램이 업데이트되어 이 페이지에서는 멈췄습니다. 새로고침해 주세요.";
            note.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 14px;border-radius:8px;background:#333;color:#fff;font-size:13px;cursor:pointer";
            note.addEventListener("click", () => note.remove());
            document.body?.append(note);
        });
        // ponytail: WXT는 ctx.isValid를 읽을 때만 무효화를 알아채므로 빈 interval로 5초마다 검사하게 한다.
        // 업데이트 전에 열린 탭은 새로고침할 때까지 기능이 멈춘다.
        ctx.setInterval(() => {}, 5_000);
    }
});
