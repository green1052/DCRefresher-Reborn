import "@/assets/styles/content.scss";
import "@/assets/styles/stealth.scss";
import "@/assets/styles/layout.scss";

import radixCss from "@radix-ui/themes/styles.css?inline";
import {createRoot} from "react-dom/client";

import overlayCss from "@/assets/styles/overlay.scss?inline";
import {ContentRoot} from "@/components/overlay/ContentRoot";
import {overlay} from "@/components/overlay/shadow";
import {initDatabase} from "@/core/database";
import {BOARD_PAGE} from "@/core/pages";
import {onMessage, type PageToggleState} from "@/core/messaging/protocol";
import {getModuleApi, loadAll, runShortcut, stopAll} from "@/core/module/registry";
import features from "@/features";
import {usePreviewStore} from "@/features/preview/ui/previewStore";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {useUiStore} from "@/stores/ui";

export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*",
        "https://gallog.dcinside.com/*",
        // 이미지 팝업(viewimagePop.php)은 gall 탭과 같은 렌더러라 번들 평가·저장소 읽기가 그대로 얹힌다. 로그인은 폰트만 빠진다
        "https://image.dcinside.com/*",
        "https://sign.dcinside.com/*"
    ],
    runAt: "document_start",
    async main(ctx) {
        // 파이어폭스는 업데이트·다시 켤 때 이전 스크립트를 정리 없이 없애고 새로 주입한다 — 죽은 인스턴스가 띄운 오버레이와 잠금을 걷는다
        const stale = document.querySelector("refresher-root");
        if (stale) {
            stale.remove();
            const {documentElement: html, body} = document;
            // 미리보기 창은 <html> 스크롤을, Radix 다이얼로그는 <body> 스크롤·바깥 클릭을 잠근다
            if (html.style.overflow === "hidden") html.style.overflow = "";
            if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
            body.removeAttribute("data-scroll-locked");
        }

        // ===== 메시징 (배경·팝업→탭) =====
        onMessage("refresher:executeShortcut", ({data: command}) => runShortcut(command));

        // 모듈이 꺼져 있거나 이 페이지에서 안 돌면 api가 없다 — 그 모듈의 토글은 팝업에 띄우지 않는다
        const pageState = (): PageToggleState[] =>
            features.flatMap((feature) => {
                const api = getModuleApi(feature.id);
                return api === undefined
                    ? []
                    : (feature.pageToggles ?? []).map((toggle) => ({
                        module: feature.id,
                        id: toggle.id,
                        label: toggle.label,
                        desc: typeof toggle.desc === "function" ? toggle.desc(api) : toggle.desc,
                        on: toggle.isOn(api)
                    }));
            });

        onMessage("refresher:pageState", pageState);
        onMessage("refresher:pageAction", ({data: {module, id}}) => {
            const api = getModuleApi(module);
            if (api !== undefined) features.find((feature) => feature.id === module)?.pageToggles?.find((toggle) => toggle.id === id)?.toggle(api);
            return pageState();
        });

        // 옵션 페이지는 저장소에 직접 쓰고, 모듈 레지스트리가 저장소를 감시해 반영한다 (메시징 없음)

        // ===== 오버레이 (shadow DOM — 디시 CSS와 Radix Themes CSS가 서로 섞이지 않게) =====
        // 페이지용 CSS(위 import)는 manifest로 주입하고, 오버레이 CSS만 css 옵션으로 shadow에 넣는다
        const mountOverlay = async (): Promise<void> => {
            if (ctx.isInvalid) return;

            const ui = await createShadowRootUi(ctx, {
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
            ui.mount();
        };

        // 대부분의 페이지는 끝내 아무것도 띄우지 않는다 — CSS 처리·shadow 삽입·첫 렌더(수십 ms)를 처음 띄울 때로 미룬다.
        // 오버레이에 새 UI(host)를 추가하면 그 표시 조건을 여기에도 넣는다 — 빠지면 그 UI는 끝내 뜨지 않는다.
        // 매 페이지 setup이 바꾸는 값(badgeColors·ratios·blockView·selected·훅 등)은 넣지 않는다 — 넣으면 늘 붙는다
        const needsOverlay = (): boolean => {
            const {toast, bubble, memo} = useUiStore.getState();
            const {visible, mini, captcha, blockPopup} = usePreviewStore.getState();
            return Boolean(toast || bubble || memo || visible || mini || captcha || blockPopup);
        };

        const mountWhenNeeded = (): void => {
            if (!needsOverlay()) return;
            offUi();
            offPreview();

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => void mountOverlay(), {once: true});
            } else {
                void mountOverlay();
            }
        };
        const offUi = useUiStore.subscribe(mountWhenNeeded);
        const offPreview = usePreviewStore.subscribe(mountWhenNeeded);

        // ===== 모듈 부트스트랩 =====
        // 차단·메모·IP DB는 글 목록·본문에서만 쓴다 — 다른 페이지(메인·검색 등)는 저장소를 읽지 않는다 (features의 urls와 같은 BOARD_PAGE)
        const board = BOARD_PAGE.test(location.href);
        if (board) await Promise.all([initBlocksStore(), initMemosStore()]);
        await loadAll(features);
        // 저장소는 요청 순서대로 읽는다 — 가장 큰 IP/밴 DB는 모듈 설정 뒤에 읽는다 (userinfo는 setup에서 기다린다).
        // userinfo가 꺼져 있어도 버블·미리보기 라벨이 나오게 여기서도 부른다
        if (board) void initDatabase().catch(console.error);

        // 확장을 끄거나 업데이트하면 이 스크립트는 남아 새로고침 폴링·저장소 호출을 계속하다 실패한다 — 모듈을 멈춘다
        ctx.onInvalidated(stopAll);
        // ponytail: WXT는 ctx.isValid를 읽을 때만 무효화를 알아채므로 빈 interval로 5초마다 검사시킨다. 업데이트 뒤 열린 탭은 새로고침 전까지 기능이 멈춘다
        ctx.setInterval(() => {}, 5_000);
    }
});
