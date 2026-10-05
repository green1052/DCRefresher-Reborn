import type {ContentScriptContext} from "wxt/utils/content-script-context";

import {overlayNeeded, watchOverlayDemands} from "@/components/overlay/demands";
import {overlay} from "@/components/overlay/shadow";
import {followDcAppearance} from "@/utils/appearance";
import {whenDomReady} from "@/utils/dom";

/**
 * 오버레이 (디시 CSS와 오버레이 CSS가 섞이지 않게 shadow DOM에 둔다). 화면에 그릴 것이 처음 생길 때 띄운다.
 */
export const mountOverlayWhenNeeded = (ctx: ContentScriptContext): void => {
    let stopAppearance: (() => void) | undefined;
    const mountOverlay = async (): Promise<void> => {
        if (ctx.isInvalid) return;

        // react-dom·Base UI·오버레이 UI는 오버레이를 처음 띄울 때 초기화한다. 번들 안에 있어 네트워크 요청은 없다.
        const [{createRoot}, {ContentRoot}] = await Promise.all([
            import("react-dom/client"),
            import("@/components/overlay/ContentRoot")
        ]);

        const ui = await createShadowRootUi(ctx, {
            name: "refresher-root",
            position: "inline",
            anchor: "body",
            // WXT 기본 리셋(:host{all:initial !important})은 pointer-events까지 되돌려 페이지 클릭을 막는다.
            // 그래서 끄고 overlay.css의 :host 리셋을 쓴다.
            inheritStyles: true,
            // index.tsx가 불러온 CSS는 WXT가 content-scripts/content.css로 묶어 두었다가 여기서 shadow에 넣는다 (:root → :host 포함).
            onMount(container) {
                // 호스트는 :host { all: initial }로 디시 페이지 글꼴을 받지 않는다. app·portal이 같이 쓰는 글꼴·글자색을 여기서 준다.
                container.classList.add("font-sans", "text-sm", "text-foreground", "antialiased");
                // 디시 다크모드를 따라간다. Tailwind(dark:)는 조상의 dark 클래스로 색을 바꾸므로 오버레이 최상위 요소(app·portal의 부모)에 붙인다.
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
        // 무효화가 CSS를 받는 동안 일어났다면 WXT의 onInvalidated(remove)는 이미 끝난 signal에 걸려 불리지 않는다.
        if (ctx.isInvalid) return;
        ui.mount();
    };

    // 대부분의 페이지는 오버레이를 끝내 띄우지 않으므로 CSS 처리·shadow 삽입·첫 렌더(수십 ms)를 처음 필요할 때로 미룬다.
    // 언제 필요한지는 UI를 그리는 스토어가 각자 등록한다 (components/overlay/demands.ts의 needOverlayWhen).
    const mountWhenNeeded = (): void => {
        if (!overlayNeeded()) return;
        stopWatching();
        whenDomReady(() => void mountOverlay().catch(console.error));
    };
    const stopWatching = watchOverlayDemands(mountWhenNeeded);
};
