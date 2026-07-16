import type {PostFetchedDataRef} from "./bodyFrame";
import type {FrameScrollApi} from "./frame";

export interface ScrollNavigationContext {
    postFetchedDataRef: PostFetchedDataRef;
    getAppStore: () => FrameScrollApi | undefined;
    getGroupStore: () => HTMLElement;
    scrolledCountRef: { value: number };
    newPostWithData: (preData: GalleryPreData, historySkip?: boolean) => void;
    getPostFetchedId: () => string;
}

// 인접 게시글 번호 조회
export function getAdjacentPostNo(
    direction: "next" | "prev",
    postFetchedDataRef: PostFetchedDataRef
): string | undefined {
    const currentId = postFetchedDataRef.value?.id;
    if (!currentId) return undefined;

    const post = document.querySelector(`.us-post[data-no="${currentId}"]`) as HTMLElement | null;
    if (!post) return undefined;

    const adjacentPost =
        direction === "next"
            ? (post.previousElementSibling as HTMLElement | null)
            : (post.nextElementSibling as HTMLElement | null);

    if (!adjacentPost || adjacentPost.getAttribute("data-type") === "icon_notice") return undefined;

    return adjacentPost.getAttribute("data-no") ?? undefined;
}

// 스크롤 시 다음/이전 게시글 이동
export function createScrollSkipHandler(
    ctx: ScrollNavigationContext,
    preData: GalleryPreData | null,
    historySkip?: boolean
): (ev: WheelEvent) => void {
    return (ev: WheelEvent): void => {
        const groupStore = ctx.getGroupStore();
        const appStore = ctx.getAppStore();

        const scrolledTop = groupStore.scrollTop === 0;
        const scroll = Math.floor(groupStore.scrollHeight - groupStore.scrollTop);
        const scrolledToBottom = Math.abs(scroll - groupStore.clientHeight) < 2;

        if (!scrolledTop && !scrolledToBottom) {
            ctx.scrolledCountRef.value = 0;
        }

        if (ev.deltaY < 0) {
            appStore?.setScrollMode("top");

            if (!scrolledTop) {
                appStore?.clearScrollMode();
            }

            if (!scrolledTop || !preData) return;

            if (ctx.scrolledCountRef.value++ < 1) return;
            ctx.scrolledCountRef.value = 0;

            preData.id = getAdjacentPostNo("prev", ctx.postFetchedDataRef) || (Number(ctx.getPostFetchedId()) - 1).toString();
            ctx.newPostWithData(preData, historySkip);
            groupStore.scrollTop = 0;

            appStore?.clearScrollMode();
        } else {
            appStore?.setScrollMode("bottom");

            if (!scrolledToBottom) {
                appStore?.clearScrollMode();
            }

            if (!scrolledToBottom || !preData) {
                return;
            }

            if (ctx.scrolledCountRef.value++ < 1) return;
            ctx.scrolledCountRef.value = 0;

            preData.id = getAdjacentPostNo("next", ctx.postFetchedDataRef) || (Number(ctx.getPostFetchedId()) + 1).toString();
            ctx.newPostWithData(preData, historySkip);

            groupStore.scrollTop = 0;
            appStore?.clearScrollMode();
        }
    };
}

// PageUp/PageDown 키보드 내비게이션
export function createNavigationKeyHandler(
    ctx: ScrollNavigationContext,
    currentPreData: () => GalleryPreData | null,
    isFrameClosed: () => boolean,
    isInputFocus: () => boolean,
    historySkip?: boolean
): (keyboardEvent: KeyboardEvent) => void {
    return (keyboardEvent: KeyboardEvent): void => {
        if (keyboardEvent.key !== "PageUp" && keyboardEvent.key !== "PageDown") return;
        const preData = currentPreData();
        if (!preData || isFrameClosed() || isInputFocus()) return;

        keyboardEvent.preventDefault();

        const isPageUp = keyboardEvent.key === "PageUp";
        const currentId = ctx.postFetchedDataRef.value?.id;
        const fallbackId = currentId ? (Number(currentId) + (isPageUp ? -1 : 1)).toString() : "";
        const nextPostNo = isPageUp
            ? getAdjacentPostNo("prev", ctx.postFetchedDataRef) || fallbackId
            : getAdjacentPostNo("next", ctx.postFetchedDataRef) || fallbackId;

        preData.id = nextPostNo;
        ctx.newPostWithData(preData, historySkip);

        const groupStore = ctx.getGroupStore();
        if (groupStore) {
            groupStore.scrollTop = 0;
        }

        ctx.getAppStore()?.clearScrollMode();
    };
}