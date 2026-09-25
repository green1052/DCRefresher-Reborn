import "@/assets/styles/content.scss";
import "@/assets/styles/stealth.scss";
import "@/assets/styles/layout.scss";

import radixCss from "@radix-ui/themes/styles.css?inline";
import {createRoot} from "react-dom/client";

import overlayCss from "@/assets/styles/overlay.scss?inline";
import {ContentRoot} from "@/components/overlay/ContentRoot";
import {overlay} from "@/components/overlay/shadow";
import {initDatabase} from "@/core/database";
import {onMessage, type PageState} from "@/core/messaging/protocol";
import {getModuleApi, loadAll, runShortcut, stopAll} from "@/core/module/registry";
import features from "@/features";
import type {BlockApi} from "@/features/block";
import type {RefreshApi} from "@/features/refresh";
import type {StealthApi} from "@/features/stealth";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";

export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*",
        "https://gallog.dcinside.com/*"
    ],
    runAt: "document_start",
    async main(ctx) {
        // ===== 메시징 (배경·팝업→탭) =====
        onMessage("refresher:executeShortcut", ({data: command}) => runShortcut(command));

        // 모듈이 꺼져 있거나 이 페이지에서 안 돌면 undefined — 팝업에 그 토글을 띄우지 않는다
        const refreshApi = () => getModuleApi("refresh") as RefreshApi | undefined;
        const stealthApi = () => getModuleApi("stealth") as StealthApi | undefined;
        const blockApi = () => getModuleApi("block") as BlockApi | undefined;

        const pageState = (): PageState => {
            const refresh = refreshApi();
            const stealth = stealthApi();
            const block = blockApi();

            return {
                refresh: refresh ? {paused: refresh.isPaused()} : null,
                stealth: stealth ? {revealed: stealth.isRevealed()} : null,
                block: block ? {revealed: block.isRevealed(), hidden: block.hiddenCount()} : null
            };
        };

        onMessage("refresher:pageState", pageState);
        onMessage("refresher:pageAction", ({data: action}) => {
            if (action === "toggleRefresh") refreshApi()?.togglePause();
            else if (action === "toggleStealth") stealthApi()?.toggle();
            else blockApi()?.toggleReveal();
            return pageState();
        });

        // 옵션 페이지는 저장소에 직접 쓰고, 모듈 레지스트리가 저장소를 감시해 반영한다 (메시징 없음)

        // ===== 오버레이 마운트 (shadow DOM — 디시 CSS와 Radix Themes CSS가 서로 섞이지 않게) =====
        // 페이지용 CSS(위 import)는 manifest로 주입하고, 오버레이 CSS만 css 옵션으로 shadow에 넣는다
        const ui = createShadowRootUi(ctx, {
            name: "refresher-root",
            position: "inline",
            anchor: "body",
            // WXT 기본 리셋(:host{all:initial !important})은 pointer-events를 강제해 페이지 클릭을 막으므로 overlay.scss의 :host 리셋을 쓴다
            inheritStyles: true,
            // shadow 안에선 :root가 매칭되지 않으므로 Radix 토큰을 :host로 옮긴다
            css: radixCss.replaceAll(":root", ":host") + overlayCss,
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

        const mountOverlay = (): void => void ui.then((instance) => instance.mount());

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", mountOverlay, {once: true});
        } else {
            mountOverlay();
        }

        // ===== 모듈 부트스트랩 =====
        await Promise.all([initBlocksStore(), initMemosStore(), initDatabase()]);
        await loadAll(features);

        // 확장을 끄거나 업데이트하면 이 스크립트는 남아 새로고침 폴링·저장소 호출을 계속하다 실패한다 — 모듈을 멈춘다
        ctx.onInvalidated(stopAll);
        // ponytail: WXT는 ctx.isValid를 읽을 때만 무효화를 알아채므로 빈 interval로 5초마다 검사시킨다. 업데이트 뒤 열린 탭은 새로고침 전까지 기능이 멈춘다
        ctx.setInterval(() => {}, 5_000);
    }
});
