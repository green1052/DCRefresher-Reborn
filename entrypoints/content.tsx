// 오버레이 CSS (components/overlay/styles.ts). 디시 페이지에 입히는 CSS는 entrypoints/page.content.css다.
import "@/components/overlay/styles";

import {ContentRoot} from "@/components/overlay/ContentRoot";
import {overlayNeeded, watchOverlayDemands} from "@/components/overlay/demands";
import {overlay} from "@/components/overlay/shadow";
import {releaseDatabase} from "@/core/database";
import {documentUrl} from "@/core/http/urls";
import {onMessage} from "@/core/messaging/protocol";
import {loadAll, pageState, runPageToggle, runShortcut, settledPageState, stopAll} from "@/core/module/registry";
import {enablesOf, isModuleEnabled} from "@/core/module/settings";
import {BOARD_PAGE, CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "@/core/pages";
import {MODULES_KEY} from "@/core/storage/items";

import loaders from "@/features";
import metas from "@/features/metas";

import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {followDcAppearance} from "@/utils/appearance";
import {whenDomReady} from "@/utils/dom";

import { render } from "preact";

export default defineContentScript({
    matches: CONTENT_MATCHES,
    excludeMatches: CONTENT_EXCLUDE_MATCHES,
    runAt: "document_start",
    // CSS는 createShadowRootUi가 content.css를 찾아 shadow에 넣는다(ui) - manifest로 페이지에 붓지 않는다.
    cssInjectionMode: "ui",
    // 새 인스턴스가 떴다는 알림을 페이지 창에 postMessage로 뿌리지 않는다 (이전 인스턴스 정리는 WXT가 CustomEvent로 한다).
    noScriptStartedPostMessage: true,
    async main(ctx) {
        // ===== 메시징 (배경, 팝업→탭) =====
        // 스크립트가 다시 주입되면 이전 인스턴스가 남아 메시지를 계속 받는다. 멈춘 모듈의 빈 상태로 팝업에 먼저 답하지 않게 무효화될 때 푼다.
        ctx.onInvalidated(onMessage("refresher:executeShortcut", ({data: command}) => runShortcut(command)));

        ctx.onInvalidated(onMessage("refresher:pageState", settledPageState));
        ctx.onInvalidated(onMessage("refresher:pageAction", ({data: action}) => {
            runPageToggle(action);
            return pageState();
        }));

        // 확장이 꺼져도 스크립트는 남아 실패하므로 무효화 때 모듈을 멈춘다 - 저장소 읽기 중 무효화돼도 뒤 등록에 가게 먼저 건다.
        ctx.onInvalidated(() => {
            stopAll();
            releaseDatabase();
        });
        // WXT는 ctx.isValid를 읽을 때만 무효화를 알아채므로 빈 interval로 5초마다 검사하게 한다.
        ctx.setInterval(() => {}, 5_000);

        // 옵션 페이지는 저장소에 직접 쓰고, 모듈 레지스트리가 저장소를 감시해 반영한다 (메시징 없음).

        // ===== 오버레이 (필요할 때만 마운트) =====
        // 디시 CSS와 섞이지 않게 shadow DOM에 그린다. 대부분의 페이지는 오버레이를 띄우지 않으니 CSS·삽입·첫 렌더를 처음 필요할 때로 미룬다 (필요 시점은 demands.ts).
        let stopAppearance: (() => void) | undefined;
        const mountOverlay = async (): Promise<void> => {
            if (ctx.isInvalid) return;

            const ui = await createShadowRootUi(ctx, {
                name: "refresher-root",
                position: "inline",
                anchor: "body",
                // WXT가 loadCss로 content.css를 받아 :root를 :host로 바꿔 넣는다.
                // WXT 기본 리셋(:host{all:initial !important})은 pointer-events까지 되돌려 페이지 클릭을 막으므로 끄고 overlay.css의 :host 리셋을 쓴다.
                inheritStyles: true,
                onMount(container) {
                    // 호스트는 :host { all: initial }로 디시 페이지 글꼴을 받지 않는다. app, portal이 같이 쓰는 글꼴, 글자색을 여기서 준다.
                    // bg-transparent는 daisyUI가 [data-theme] 요소에 주는 배경(base-100)을 끈다 - 오버레이는 페이지를 덮으면 안 된다.
                    container.classList.add("font-sans", "text-sm", "text-base-content", "antialiased", "bg-transparent");
                    // 디시 다크모드를 따라간다. Tailwind(dark:)와 daisyUI 테마는 조상의 .dark, data-theme를 보므로 서버가 최상위 요소(app, portal의 부모)에 붙인다.
                    stopAppearance = followDcAppearance(container);
                    const app = document.createElement("div");
                    const portal = document.createElement("div");
                    portal.id = "portal";
                    container.append(app, portal);

                    overlay.portal = portal;

                    render(<ContentRoot/>, app);
                    return app;
                },
                onRemove: (app) => {
                    stopAppearance?.();
                    if (app) render(null, app);
                }
            });
            // 무효화가 CSS를 받는 동안 일어났다면 WXT의 onInvalidated(remove)는 이미 끝난 signal에 걸려 불리지 않는다.
            if (ctx.isInvalid) return;
            ui.mount();
        };
        const mountWhenNeeded = (): void => {
            if (!overlayNeeded()) return;
            stopWatching();
            whenDomReady(() => void mountOverlay().catch(console.error));
        };
        const stopWatching = watchOverlayDemands(mountWhenNeeded);

        // ===== 모듈 부트스트랩 =====
        // 차단, 메모 저장소는 BOARD_PAGE에서만, 읽는 모듈이 하나라도 켜져 있을 때만 읽는다. 스킵한 회차는 다음 기회에 다시 본다.
        const STORE_USERS = ["block", "preview", "userinfo"];
        let storesReady: Promise<void> | undefined;
        const ensureStores = (): Promise<void> => storesReady ??= (async () => {
            const enables = enablesOf(await storage.getItem(MODULES_KEY));
            const needed = metas.filter((meta) => STORE_USERS.includes(meta.id)).some((meta) => isModuleEnabled(meta, enables));
            if (!needed) {
                storesReady = undefined;
                return;
            }
            await Promise.all([initBlocksStore(ctx.signal), initMemosStore(ctx.signal)]);
        })();
        const board = BOARD_PAGE.test(documentUrl.pathname);
        await loadAll(metas, loaders, ctx.signal, board ? ensureStores : undefined);
    }
});
