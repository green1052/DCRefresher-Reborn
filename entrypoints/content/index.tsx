import "@/assets/styles/content.scss";
import "@/assets/styles/stealth.scss";
import "@/assets/styles/layout.scss";

import {createRoot} from "react-dom/client";

import {ContentRoot} from "@/components/overlay/ContentRoot";
import {eventBus} from "@/core/eventbus/bus";
import * as blockCore from "@/core/block";
import * as memoCore from "@/core/memo";
import {onMessage} from "@/core/messaging/protocol";
import {loadAll, modules} from "@/core/module/registry";
import features from "@/features";
import {useUiStore} from "@/stores/ui";

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
    async main() {
        // ===== 메시징 (팝업→탭, 배경→탭) =====
        onMessage("refresher:contextMenu", ({data: action}) => {
            switch (action) {
                case "blockSelected":
                    eventBus.emit("refresherRequestBlock", {target: "user"});
                    break;
                case "dcconSelected":
                    eventBus.emit("refresherRequestBlock", {target: "dccon"});
                    break;
                case "dcconAllSelected":
                    eventBus.emit("refresherRequestBlock", {target: "dccon", blockAllDccon: true});
                    break;
                case "memoSelected":
                    useUiStore.getState().openMemoForSelected();
                    break;
                case "searchSauceNao":
                    eventBus.emit("imageSearch");
                    break;
            }
        });

        onMessage("refresher:executeShortcut", ({data: command}) => modules.runShortcut(command));

        onMessage("refresher:askMemo", ({data}) => {
            useUiStore.getState().openMemo({[data.type]: data.user}, data.type);
        });

        // ===== 메시징 (옵션→탭) =====
        onMessage("refresher:getModuleSchema", () => modules.getSchema());

        onMessage("refresher:toggleModule", async ({data}) => {
            await modules.toggle(data.id, data.value);
        });

        onMessage("refresher:setSetting", async ({data}) => modules.setSetting(data.id, data.key, data.value));

        // ===== 오버레이 마운트 =====
        const mountOverlay = (): void => {
            if (document.getElementById("refresher-root")) return;

            const host = document.createElement("div");
            host.id = "refresher-root";
            document.body.append(host);
            createRoot(host).render(<ContentRoot />);
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", mountOverlay, {once: true});
        } else {
            mountOverlay();
        }

        // ===== 모듈 부트스트랩 =====
        await Promise.all([blockCore.init(), memoCore.init()]);
        await loadAll(features);
    }
});
