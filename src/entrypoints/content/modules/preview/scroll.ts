import type {PostFetchedDataRef} from "./bodyFrame";
import type {FrameScrollApi} from "./frame";

enum ScrollMode {
    NOT_DEFINED,
    FIXED,
    VARIABLE
}

interface ScrollSession {
    delta: number[];
    peak: number;
    fired: number;
}

type ScrollEventHandler = (ev: WheelEvent, ...args: unknown[]) => void;

const SCROLL_TAIL_THRESHOLD = 60;
const NEW_EVENT_RATIO = 4;
const SESSION_RESET_DELAY = 100;
const MAX_DELTA_HISTORY = 50;
const MIN_DELTA_THRESHOLD = 2;
const FIXED_DELTA_VALUE = 100;

export class ScrollDetection {
    lastEvent: number;
    events: Record<string, ScrollEventHandler[]>;
    session: ScrollSession;
    mode: number;

    constructor() {
        this.lastEvent = 0;
        this.events = {};
        this.mode = ScrollMode.NOT_DEFINED;
        this.session = this.createSession();
    }

    initSession(): void {
        this.session = this.createSession();
    }

    emit(event: string, ...args: unknown[]): void {
        this.events[event]?.forEach((func) => {
            (func as (...a: unknown[]) => void)(...args);
        });
    }

    listen(event: string, cb: ScrollEventHandler): void {
        this.events[event] ??= [];
        this.events[event].push(cb);
    }

    scroll(ev: WheelEvent): void {
        this.emit("scroll", ev);
        this.session.fired = Date.now();
    }

    addMouseEvent(ev: WheelEvent): void {
        const lastEvent = this.lastEvent;
        this.lastEvent = Date.now();

        const absoluteDelta = Math.abs(ev.deltaY);

        // 미세 스크롤 무시
        if (absoluteDelta < MIN_DELTA_THRESHOLD) {
            this.initSession();
            return;
        }

        // 이전 세션과 다른 스크롤 시 세션 초기화
        if (Date.now() - lastEvent > SESSION_RESET_DELAY) {
            this.initSession();
        }

        if (this.session.delta.length !== 0) {
            const lastDelta = this.session.delta[this.session.delta.length - 1];

            if (lastDelta === FIXED_DELTA_VALUE && this.average(this.session.delta) === FIXED_DELTA_VALUE) {
                // FIXED 모드: delta 절댓값이 100으로 고정 (deltaY 미지원 또는 마우스)
                this.mode = ScrollMode.FIXED;

                if (!this.session.fired) this.scroll(ev);
                else if (Date.now() - lastEvent > SESSION_RESET_DELAY) this.initSession();
            } else {
                // VARIABLE 모드: delta가 다양한 값 (트랙패드, 관성 스크롤)
                this.mode = ScrollMode.VARIABLE;

                if (lastDelta > this.session.peak) {
                    // 감속 구간 진입 또는 새로운 이벤트
                    if (this.session.fired) {
                        if (Date.now() - this.session.fired > SCROLL_TAIL_THRESHOLD && lastDelta / NEW_EVENT_RATIO > absoluteDelta) {
                            this.initSession();
                        }
                    } else {
                        this.scroll(ev);
                    }
                } else {
                    this.session.peak = Math.abs(ev.deltaY);
                }
            }
        }

        if (this.session.delta.length < MAX_DELTA_HISTORY) {
            this.session.delta.push(Math.abs(ev.deltaY));
        }
    }

    private createSession(): ScrollSession {
        return {delta: [], peak: 0, fired: 0};
    }

    private average(arr: number[]): number {
        if (arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b) / arr.length;
    }
}

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

        const isUp = ev.deltaY < 0;
        const atEdge = isUp ? scrolledTop : scrolledToBottom;
        const direction = isUp ? "prev" : "next";
        const delta = isUp ? -1 : 1;

        appStore?.setScrollMode(isUp ? "top" : "bottom");

        if (!atEdge) {
            appStore?.clearScrollMode();
            return;
        }

        if (!preData) return;

        if (ctx.scrolledCountRef.value++ < 1) return;
        ctx.scrolledCountRef.value = 0;

        preData.id = getAdjacentPostNo(direction, ctx.postFetchedDataRef) || (Number(ctx.getPostFetchedId()) + delta).toString();
        ctx.newPostWithData(preData, historySkip);
        groupStore.scrollTop = 0;

        appStore?.clearScrollMode();
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