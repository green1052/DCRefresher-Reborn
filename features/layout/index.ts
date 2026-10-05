import {defineModule} from "@/core/module/define";
import {isViewPage, queryString} from "@/core/http/urls";
import {writeStyle} from "@/utils/dom";

import meta, {type Ctx, HIDE_KEYS, HIDE_OPTIONS} from "./meta";

const COMPACT_KEYS = new Set(["forceCompact", "useCompactModeOnView"]);
const PUSH_CLASS = "refresherPushToRight";
const HIDE_STYLE_ID = "refresher-layout-hide";

let widthQuery: MediaQueryList | null = null;
let widthWatch: AbortController | null = null;

const applyCompact = (ctx: Ctx): void => {
    const compact = widthQuery?.matches === true || ctx.settings.forceCompact;
    const useCompact = compact && (!isViewPage || ctx.settings.useCompactModeOnView);

    document.documentElement.classList.toggle("refresherCompact", useCompact);
};

/** 창 폭이 기준(activePixel)을 넘나들 때만 다시 맞춘다 — resize는 창 크기를 바꾸는 동안 수십 번 온다. */
const watchWidth = (ctx: Ctx): void => {
    widthWatch?.abort();
    widthWatch = new AbortController();
    widthQuery = window.matchMedia(`(max-width: ${ctx.settings.activePixel}px)`);
    widthQuery.addEventListener("change", () => applyCompact(ctx), {signal: AbortSignal.any([ctx.signal, widthWatch.signal])});
    applyCompact(ctx);
};

const applyHide = (ctx: Ctx): void => {
    // 공지 모아보기(?exception_mode=notice)에서는 공지를 숨기지 않는다 (디시 공지도).
    const noticePage = queryString("exception_mode") === "notice";

    // 선택자마다 규칙을 따로 둔다. 하나로 합치면 :has 등을 모르는 브라우저가 규칙 전체를 버린다.
    writeStyle(HIDE_STYLE_ID, HIDE_KEYS
        .filter((key) => ctx.settings[key] && !(noticePage && (key === "removeNotice" || key === "removeDCNotice")))
        .map((key) => `${HIDE_OPTIONS[key].selector} { display: none !important; }`)
        .join("\n"));

    // 본문 확장은 잡다 링크가 숨겨졌을 때만 (page.css의 폭 조정).
    document.documentElement.classList.toggle(PUSH_CLASS, ctx.settings.pushToRight && ctx.settings.hideUselessView);
};

export default defineModule({
    ...meta,

    setup(ctx) {
        watchWidth(ctx);
        applyHide(ctx);
        ctx.onSettingsChanged((keys) => {
            if (keys.has("activePixel")) watchWidth(ctx);
            if (!keys.isDisjointFrom(COMPACT_KEYS)) applyCompact(ctx);
            if ([...keys].some((key) => key !== "activePixel" && !COMPACT_KEYS.has(key))) applyHide(ctx);
        });
    },

    revoke() {
        document.querySelector(`style#${HIDE_STYLE_ID}`)?.remove();
        widthWatch?.abort();
        widthQuery = null;

        document.documentElement.classList.remove("refresherCompact", PUSH_CLASS);
    }
});
