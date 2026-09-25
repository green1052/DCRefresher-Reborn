import "@/assets/styles/content.scss";
import "@/assets/styles/stealth.scss";
import "@/assets/styles/layout.scss";

import radixCss from "@radix-ui/themes/styles.css?inline";
import {createRoot} from "react-dom/client";

import overlayCss from "@/assets/styles/overlay.scss?inline";
import {ContentRoot} from "@/components/overlay/ContentRoot";
import {overlay} from "@/components/overlay/shadow";
import {eventBus} from "@/core/eventbus/bus";
import {onMessage} from "@/core/messaging/protocol";
import {loadAll, modules} from "@/core/module/registry";
import features from "@/features";
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
        // ===== 메시징 (배경→탭) =====
        onMessage("refresher:contextMenu", ({data: action}) => {
            if (action === "searchSauceNao") eventBus.emit("imageSearch");
        });

        onMessage("refresher:executeShortcut", ({data: command}) => modules.runShortcut(command));

        // ===== 메시징 (옵션→탭) =====
        onMessage("refresher:getModuleSchema", () => modules.getSchema());

        onMessage("refresher:toggleModule", async ({data}) => {
            await modules.toggle(data.id, data.value);
        });

        onMessage("refresher:setSetting", async ({data}) => modules.setSetting(data.id, data.key, data.value));

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
            onMount(container, shadow) {
                const app = document.createElement("div");
                const portal = document.createElement("div");
                portal.id = "portal";
                container.append(app, portal);

                overlay.root = shadow;
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
        await Promise.all([initBlocksStore(), initMemosStore()]);
        await loadAll(features);
    }
});
