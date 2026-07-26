import {miniPreviewClose, miniPreviewCreate, miniPreviewMove, type MiniPreviewState} from "./miniPreview";
import type {PostCache} from "./cache";
import type {PreviewStatus} from "./controller";

// 게시글 메타데이터 추출 (우클릭/툴팁 대상)
export function getRelevantData(ev: MouseEvent): GalleryPreData {
    const element = (ev.target as HTMLElement).closest<HTMLElement>(".ub-content");

    let id = "";
    let notice = false;
    let recommend = false;
    let type = "";
    let title = "";
    let link = "";
    let gallery = "";

    const em = element?.querySelector<HTMLElement>(".icon_img");

    if (em) {
        const attr = em.getAttribute("class")!;
        type = attr.split(" ").at(-1) ?? "icon_txt";
        notice = attr.includes("icon_notice");
        recommend = attr.includes("icon_recomimg");
    }

    const linkElement = element?.querySelector<HTMLAnchorElement>("a:not(.reply_numbox)");

    if (linkElement) {
        title = (linkElement.textContent ?? "").trim();

        const url = new URL(linkElement.getAttribute("href") ?? "", location.href);
        id = url.searchParams.get("no") ?? "";
        link = url.href;
        gallery = url.searchParams.get("id") ?? "";
    }

    return {id, gallery, title, link, notice, recommend, type};
}

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
                ctx.postCaches
            );
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