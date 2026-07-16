import {miniPreviewClose, miniPreviewCreate, miniPreviewMove, type MiniPreviewState} from "./miniPreview";
import {getRelevantData} from "./getRelevantData";
import {previewRequest} from "./request";
import type {PostCache} from "./cache";
import type {PreviewStatus} from "./controller";

export interface PreviewInputContext {
    status: PreviewStatus;
    postCaches: PostCache;
    miniPreview: MiniPreviewState;
    previewFrame: (ev: MouseEvent | null, prd?: GalleryPreData, historySkip?: boolean) => void;
    preventOpenRef: { value: boolean };
    lastPressRef: { value: number };
}

// 우클릭 길게 누름 감지 (기본 우클릭 메뉴 방지용)
export function createMousePressHandler(ctx: PreviewInputContext): (ev: MouseEvent) => void {
    return (ev: MouseEvent): void => {
        if (ev.button !== 2) return;

        if (ev.type === "mousedown") {
            ctx.lastPressRef.value = Date.now();
            return;
        }

        if (
            ev.type === "mouseup" &&
            ctx.lastPressRef.value > 0 &&
            Date.now() - ctx.status.longPressDelay > ctx.lastPressRef.value
        ) {
            ctx.preventOpenRef.value = true;
            ctx.lastPressRef.value = 0;
        }
    };
}

// 이미지 차단 버튼 핸들러
export function createImageBlockClickHandler(): (ev: MouseEvent) => void {
    return (ev: MouseEvent) => {
        if (!(ev.target instanceof Element)) return;

        const button = ev.target.closest<HTMLElement>(".btn_img_block");
        if (!button) return;

        ev.preventDefault();
        ev.stopPropagation();

        button.style.display = "none";
        const img = button.closest("div")?.querySelector("img");
        if (img) img.style.display = "";
    };
}

// 요소에 미리보기 이벤트 핸들러 등록
export function attachElementHandlers(
    element: HTMLElement,
    handleMousePress: (ev: MouseEvent) => void,
    signal: AbortSignal,
    ctx: PreviewInputContext
): void {
    if (element.dataset.refresherPreview === "true") return;

    let timer: number | undefined;

    element.dataset.refresherPreview = "true";
    signal.addEventListener(
        "abort",
        () => {
            if (typeof timer === "number") {
                window.clearTimeout(timer);
            }
            delete element.dataset.refresherPreview;
        },
        {once: true}
    );

    element.addEventListener("mouseup", handleMousePress, {signal});
    element.addEventListener("mousedown", handleMousePress, {signal});
    element.addEventListener(ctx.status.reversePreviewKey ? "click" : "contextmenu", (ev) => {
        if (element.closest(".us-post")?.classList.contains("refresherBlur")) return;

        if (typeof timer === "number") {
            window.clearTimeout(timer);
            timer = undefined;
        }

        ctx.previewFrame(ev);
    }, {signal});

    if (ctx.status.reversePreviewKey) {
        element.addEventListener("contextmenu", (e) => {
            e.preventDefault();

            const target = e.target as HTMLAnchorElement;

            location.href =
                target.getAttribute("href") ??
                target.closest(".us-post")?.querySelector("a:not(.reply_numbox)")?.getAttribute("href") ??
                location.href;
        }, {signal});
    }

    element.addEventListener("mouseenter", (ev) => {
        if (
            !ctx.status.tooltipMode ||
            element.closest(".us-post")?.classList.contains("refresherBlur") ||
            typeof timer === "number" ||
            (ctx.status.tooltipRatioDisable && element.closest(".us-post")?.querySelector(".ratio[style]"))
        )
            return;

        timer = window.setTimeout(() => {
            miniPreviewCreate(
                ctx.miniPreview,
                ev,
                ctx.status.tooltipMode,
                ctx.status.tooltipMediaHide,
                ctx.status.tooltipInteraction,
                getRelevantData,
                ctx.postCaches,
                previewRequest
            );

            if (ctx.status.tooltipInteraction)
                miniPreviewMove(ctx.miniPreview, ev, ctx.status.tooltipMode, ctx.status.tooltipInteraction);
        }, ctx.status.tooltipDelay);
    }, {signal});

    element.addEventListener("mousemove", (ev) => {
        if (ctx.status.tooltipMode && !ctx.status.tooltipInteraction)
            miniPreviewMove(ctx.miniPreview, ev, ctx.status.tooltipMode, ctx.status.tooltipInteraction);
    }, {signal});

    element.addEventListener("mouseleave", () => {
        if (!ctx.status.tooltipMode) return;

        if (typeof timer === "number") {
            window.clearTimeout(timer);
            timer = undefined;
        }

        miniPreviewClose(ctx.miniPreview, ctx.status.tooltipMode);
    }, {signal});
}