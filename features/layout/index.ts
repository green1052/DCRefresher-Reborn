import {defineModule} from "@/core/module/define";
import {isViewPage, queryString} from "@/core/http/urls";
import {writeStyle} from "@/utils/dom";

import meta, {type Ctx, HIDE_KEYS, HIDE_OPTIONS} from "./meta";

const COMPACT_KEYS = new Set<keyof Ctx["settings"]>(["forceCompact", "useCompactModeOnView"]);
const PUSH_CLASS = "refresherPushToRight";
const HIDE_STYLE_ID = "refresher-layout-hide";

// 디시콘 샵은 본문 영역이 .right_content라서 컴팩트 규칙이 사이드바로 판단해 숨긴다.
const isDcconShop = location.hostname === "dccon.dcinside.com";

/** narrow: 창 폭이 기준(activePixel)보다 좁은지. */
const applyCompact = (ctx: Ctx, narrow: boolean): void => {
    const compact = narrow || ctx.settings.forceCompact;
    const useCompact = compact && !isDcconShop && (!isViewPage || ctx.settings.useCompactModeOnView);

    document.documentElement.classList.toggle("refresherCompact", useCompact);
};

/** 정리 함수는 마지막으로 쓴 <style>을 뗀다 (writeStyle이 같은 요소를 이어 쓰므로 처음 것과 같다). */
let removeHideStyle: (() => void) | undefined;

const applyHide = (ctx: Ctx): void => {
    // 공지 모아보기(?exception_mode=notice)에서는 공지를 숨기지 않는다 (디시 공지도).
    const noticePage = queryString("exception_mode") === "notice";

    // 선택자마다 규칙을 따로 둔다. 하나로 합치면 :has 등을 모르는 브라우저가 규칙 전체를 버린다.
    removeHideStyle = writeStyle(HIDE_STYLE_ID, HIDE_KEYS
        .filter((key) => ctx.settings[key] && !(noticePage && (key === "removeNotice" || key === "removeDCNotice")))
        .map((key) => `${HIDE_OPTIONS[key].selector} { display: none !important; }`)
        .join("\n"));

    // 본문 확장은 잡다 링크가 숨겨졌을 때만 (page.css의 폭 조정).
    document.documentElement.classList.toggle(PUSH_CLASS, ctx.settings.pushToRight && ctx.settings.hideUselessView);
};

export default defineModule(meta, {
    setup(ctx) {
        ctx.onRevoke(() => {
            // 폭 감시는 모듈을 멈출 때 ctx.signal로 이미 풀렸다 (watchWidth).
            removeHideStyle?.();

            document.documentElement.classList.remove("refresherCompact", PUSH_CLASS);
        });

        // 창 폭 감시. 기준이 바뀌면 새로 건다.
        let width: { query: MediaQueryList; watch: AbortController } | undefined;
        const compact = (): void => applyCompact(ctx, width?.query.matches === true);
        /** 창 폭이 기준(activePixel)을 넘나들 때만 다시 맞춘다 — resize는 창 크기를 바꾸는 동안 수십 번 온다. */
        const watchWidth = (): void => {
            width?.watch.abort();
            width = {query: window.matchMedia(`(max-width: ${ctx.settings.activePixel}px)`), watch: new AbortController()};
            width.query.addEventListener("change", compact, {signal: AbortSignal.any([ctx.signal, width.watch.signal])});
            compact();
        };

        watchWidth();
        applyHide(ctx);
        ctx.onSettingsChanged((keys) => {
            if (keys.has("activePixel")) watchWidth();
            if (!keys.isDisjointFrom(COMPACT_KEYS)) compact();
            if ([...keys].some((key) => key !== "activePixel" && !COMPACT_KEYS.has(key))) applyHide(ctx);
        });
    }
});
