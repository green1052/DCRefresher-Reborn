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

// 문서 레벨 이벤트 위임. 목록 새로고침으로 행이 교체돼도 리스너가 살아있고,
// 분리된 노드를 리스너가 붙잡아 두던 누수도 사라진다.
export function setupDelegatedPreviewHandlers(
    ctx: PreviewInputContext,
    handleMousePress: (ev: MouseEvent) => void,
    signal: AbortSignal
): void {
    const tooltipTimers = new Map<Element, number>();

    signal.addEventListener("abort", () => {
        for (const timer of tooltipTimers.values()) {
            window.clearTimeout(timer);
        }
        tooltipTimers.clear();
    }, {once: true});

    const matchElement = (ev: Event): HTMLElement | null =>
        (ev.target as HTMLElement).closest<HTMLElement>(
            ctx.status.expandRecognizeRange ? ".ub-content" : ".ub-word"
        );

    const clearTimer = (element: Element): void => {
        const timer = tooltipTimers.get(element);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            tooltipTimers.delete(element);
        }
    };

    // 미리보기 열기 (반전 설정이면 좌클릭, 아니면 우클릭)
    document.addEventListener(ctx.status.reversePreviewKey ? "click" : "contextmenu", (ev) => {
        const element = matchElement(ev);
        if (!element || !element.closest(".gall_list")) return;
        if (element.closest(".us-post")?.classList.contains("refresherBlur")) return;

        clearTimer(element);
        ctx.previewFrame(ev as MouseEvent);
    }, {signal});

    // 좌클릭 미리보기 반전 시 원래 우클릭 동작(게시글 이동) 유지
    if (ctx.status.reversePreviewKey) {
        document.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();

            const target = ev.target as HTMLAnchorElement;

            location.href =
                target.getAttribute("href") ??
                target.closest(".us-post")?.querySelector("a:not(.reply_numbox)")?.getAttribute("href") ??
                location.href;
        }, {signal});
    }

    document.addEventListener("mouseup", handleMousePress, {signal});
    document.addEventListener("mousedown", handleMousePress, {signal});

    // 툴팁 미리보기
    document.addEventListener("mouseover", (ev) => {
        const element = matchElement(ev);
        if (!element) return;

        if (
            !ctx.status.tooltipMode ||
            element.closest(".us-post")?.classList.contains("refresherBlur") ||
            tooltipTimers.has(element) ||
            (ctx.status.tooltipRatioDisable && element.closest(".us-post")?.querySelector(".ratio[style]"))
        ) {
            return;
        }

        tooltipTimers.set(element, window.setTimeout(() => {
            tooltipTimers.delete(element);
            miniPreviewCreate(
                ctx.miniPreview,
                ev as MouseEvent,
                ctx.status.tooltipMode,
                ctx.status.tooltipMediaHide,
                ctx.status.tooltipInteraction,
                getRelevantData,
                ctx.postCaches
            );
        }, ctx.status.tooltipDelay));
    }, {signal});

    document.addEventListener("mousemove", (ev) => {
        if (ctx.status.tooltipMode && !ctx.status.tooltipInteraction) {
            miniPreviewMove(ctx.miniPreview, ev, ctx.status.tooltipMode, ctx.status.tooltipInteraction);
        }
    }, {signal});

    document.addEventListener("mouseout", (ev) => {
        const element = matchElement(ev);
        if (element && (!ev.relatedTarget || !element.contains(ev.relatedTarget as Node))) {
            clearTimer(element);
            miniPreviewClose(ctx.miniPreview, ctx.status.tooltipMode);
        }
    }, {signal});
}
