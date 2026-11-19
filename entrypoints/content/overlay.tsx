import type {ContentScriptContext} from "wxt/utils/content-script-context";

import {http} from "@/core/http/client";
import {overlayNeeded, watchOverlayDemands} from "@/components/overlay/demands";
import {ContentRoot} from "@/components/overlay/ContentRoot";
import {overlay} from "@/components/overlay/shadow";
import {setDarkAppearance} from "@/utils/appearance";
import {whenDomReady} from "@/utils/dom";
import {createRoot} from "react-dom/client";

// 디시 CSS와 섞이지 않게 shadow DOM에 그리며, 파이어폭스의 늦은 동적 import 버그 때문에 정적으로 불러온다.
export const mountOverlayWhenNeeded = (ctx: ContentScriptContext): void => {
    const mountOverlay = async (): Promise<void> => {
        if (ctx.isInvalid) return;

        // cssInjectionMode: "manual" - WXT의 loadCss는 ENTRYPOINT(="html") 이름으로 찾아 content.css를 못 얻는다.
        const getURL = browser.runtime.getURL as (path: string) => string;
        const css = (await http.get(getURL("/content-scripts/content.css")).text()).replaceAll(":root", ":host");
        const ui = await createShadowRootUi(ctx, {
            name: "refresher-root",
            position: "inline",
            anchor: "body",
            css,
            // WXT 기본 리셋(:host{all:initial !important})은 pointer-events까지 되돌려 페이지 클릭을 막으므로 끄고 overlay.css의 :host 리셋을 쓴다.
            inheritStyles: true,
            // index.tsx가 불러온 CSS는 WXT가 content-scripts/content.css로 묶어 두었다가 여기서 shadow에 넣는다 (:root → :host 포함).
            onMount(container) {
                // 호스트는 :host { all: initial }로 디시 페이지 글꼴을 받지 않는다. app, portal이 같이 쓰는 글꼴, 글자색을 여기서 준다.
                container.classList.add("font-sans", "text-sm", "text-base-content", "antialiased");
                setDarkAppearance(container);
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
                root?.unmount();
            }
        });
        // 무효화가 CSS를 받는 동안 일어났다면 WXT의 onInvalidated(remove)는 이미 끝난 signal에 걸려 불리지 않는다.
        if (ctx.isInvalid) return;
        ui.mount();
    };

    // 대부분의 페이지는 오버레이를 띄우지 않으니 CSS·삽입·첫 렌더를 처음 필요할 때로 미룬다 (필요 시점은 demands.ts).
    const mountWhenNeeded = (): void => {
        if (!overlayNeeded()) return;
        stopWatching();
        whenDomReady(() => void mountOverlay().catch(console.error));
    };
    const stopWatching = watchOverlayDemands(mountWhenNeeded);
};
