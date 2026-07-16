import eventBus from "@/core/eventbus";
import filter from "@/core/filtering";
import Frame, {type FrameScrollApi} from "./frame";
import type {PreviewFrame} from "./previewFrame";
import {makeBodyFrame, type PostFetchedDataRef} from "./bodyFrame";
import {makeCommentFrame} from "./commentFrame";
import {previewRequest} from "./request";
import {blockPreset, closeAllPopups, panel} from "./panel";
import {miniPreviewClose, miniPreviewCreate, miniPreviewMove, type MiniPreviewState} from "./miniPreview";
import {getRelevantData} from "./getRelevantData";
import type {PostCache} from "./cache";
import {ScrollDetection} from "./scrollDetection";
import {moduleEnableStorage, moduleSettingStorage} from "@/storage/wxtStorage";

export interface PreviewStatus {
    tooltipMode: boolean;
    tooltipMediaHide: boolean;
    tooltipDelay: number;
    tooltipInteraction: boolean;
    tooltipRatioDisable: boolean;
    reversePreviewKey: boolean;
    longPressDelay: number;
    scrollToSkip: boolean;
    colorPreviewLink: boolean;
    autoRefreshComment: boolean;
    commentRefreshInterval: number;
    toggleBlur: boolean;
    toggleBackgroundBlur: boolean;
    toggleAdminPanel: boolean;
    useKeyPress: boolean;
    blockPresetDay: string;
    blockPresetReason: string;
    blockPresetDelete: boolean;
    blockPresetUserType: boolean;
    expandRecognizeRange: boolean;
    experimentalComment: boolean;
    disableCache: boolean;
    archiveArticle: boolean;
    blockImage: boolean;
}

export class PreviewController {
    private frame?: Frame;
    private previewNavigationKeyDown: ((ev: KeyboardEvent) => void) | null = null;

    private blurConfig = false;
    private replyConfig = false;
    private gifControlConfig = false;

    private filterUuid: string | null = null;
    private popStateHandler: ((ev: PopStateEvent) => void) | null = null;
    private imageBlockClickHandler: ((ev: MouseEvent) => void) | null = null;
    private elementEventController: AbortController | null = null;
    private previewAbortController: AbortController | null = null;
    private previewSignal: AbortSignal | null = null;
    private refreshIntervalId: number | null = null;

    private preventOpen = false;
    private lastPress = 0;
    private historyClose = false;
    private frameClosed = false;
    private titleStore: string | null = null;
    private urlStore: string | null = null;

    private currentPreData: GalleryPreData | null = null;
    private readonly postFetchedDataRef: PostFetchedDataRef = {value: undefined};

    private appStore: FrameScrollApi | undefined;
    private groupStore!: HTMLElement;
    private scrolledCount = 0;

    private destroyed = false;

    constructor(
        private readonly status: PreviewStatus,
        private readonly postCaches: PostCache,
        private readonly miniPreview: MiniPreviewState,
        private readonly gallery: string | undefined
    ) {
    }

    async setup(): Promise<void> {
        await this.loadConfigs();

        this.elementEventController = new AbortController();
        const elementEventSignal = this.elementEventController.signal;

        this.setupImageBlockHandler();
        this.applyBlockPreset();

        const handleMousePress = (ev: MouseEvent): void => this.handleMousePress(ev);

        this.filterUuid = filter.add(
            `.gall_list .ub-content${this.status.expandRecognizeRange ? "" : " .ub-word"}`,
            (element: HTMLElement) => this.addHandler(element, handleMousePress, elementEventSignal),
            {neverExpire: true}
        );

        this.popStateHandler = (ev: PopStateEvent) => this.handlePopState(ev);
        window.addEventListener("popstate", this.popStateHandler);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;

        if (this.filterUuid) filter.remove(this.filterUuid, true);
        this.filterUuid = null;

        if (this.popStateHandler) {
            window.removeEventListener("popstate", this.popStateHandler);
            this.popStateHandler = null;
        }

        if (this.imageBlockClickHandler) {
            document.removeEventListener("click", this.imageBlockClickHandler);
            this.imageBlockClickHandler = null;
        }

        if (this.previewNavigationKeyDown) {
            document.removeEventListener("keydown", this.previewNavigationKeyDown);
            this.previewNavigationKeyDown = null;
        }

        closeAllPopups();

        this.clearRefreshInterval();

        this.previewAbortController?.abort();
        this.previewAbortController = null;
        this.previewSignal = null;
        this.elementEventController?.abort();
        this.elementEventController = null;

        if (this.frame) {
            this.frame.destroy();
            this.frame = undefined;
        }
    }

    private async loadConfigs(): Promise<void> {
        const contentBlockEnabled = await moduleEnableStorage("컨텐츠 차단").getValue();
        if (contentBlockEnabled) {
            const [blur, replyRemove] = await Promise.all([
                moduleSettingStorage("컨텐츠 차단", "blur").getValue(),
                moduleSettingStorage("컨텐츠 차단", "replyRemove").getValue()
            ]);
            this.blurConfig = Boolean(blur);
            this.replyConfig = Boolean(replyRemove);
        }

        this.gifControlConfig = Boolean(
            (await moduleEnableStorage("관리").getValue()) && Boolean(await moduleSettingStorage("관리", "enableGifControl").getValue())
        );
    }

    private setupImageBlockHandler(): void {
        this.imageBlockClickHandler = (ev: MouseEvent) => {
            if (!(ev.target instanceof Element)) return;

            const button = ev.target.closest<HTMLElement>(".btn_img_block");
            if (!button) return;

            ev.preventDefault();
            ev.stopPropagation();

            button.style.display = "none";
            const img = button.closest("div")?.querySelector("img");
            if (img) img.style.display = "";
        };
        document.addEventListener("click", this.imageBlockClickHandler);
    }

    private applyBlockPreset(): void {
        blockPreset.day = this.status.blockPresetDay;
        blockPreset.reason = this.status.blockPresetReason;
        blockPreset.delete = this.status.blockPresetDelete;
        blockPreset.user_type = this.status.blockPresetUserType;
    }

    private getFrameApp(): FrameScrollApi | undefined {
        return this.frame?.app;
    }

    private getPostFetchedId(): string {
        return this.postFetchedDataRef.value?.id ?? "";
    }

    private clearRefreshInterval(): void {
        if (this.refreshIntervalId) {
            window.clearInterval(this.refreshIntervalId);
            this.refreshIntervalId = null;
        }
    }

    private setRefreshInterval(id: number): void {
        this.refreshIntervalId = id;
    }

    private buildBodyFrame(frame: PreviewFrame, preData: GalleryPreData, signal: AbortSignal, historySkip?: boolean): void {
        makeBodyFrame({
            frame,
            preData,
            signal,
            historySkip,
            gallery: this.gallery,
            disableCache: this.status.disableCache,
            colorPreviewLink: this.status.colorPreviewLink,
            gifControl: this.gifControlConfig,
            blockImage: this.status.blockImage,
            postCaches: this.postCaches,
            postFetchedDataRef: this.postFetchedDataRef,
            getGroupElement: () => this.getFrameApp()?.groupElement
        });
    }

    private buildCommentFrame(frame: PreviewFrame, preData: GalleryPreData, signal: AbortSignal): void {
        makeCommentFrame({
            frame,
            preData,
            signal,
            experimentalComment: this.status.experimentalComment,
            autoRefreshComment: this.status.autoRefreshComment,
            commentRefreshInterval: this.status.commentRefreshInterval,
            disableCache: this.status.disableCache,
            archiveArticle: this.status.archiveArticle,
            blurConfig: this.blurConfig,
            replyConfig: this.replyConfig,
            gallery: this.gallery,
            postCaches: this.postCaches,
            postFetchedDataRef: this.postFetchedDataRef,
            getFrameApp: () => this.getFrameApp(),
            clearRefreshInterval: () => this.clearRefreshInterval(),
            setRefreshInterval: (id: number) => this.setRefreshInterval(id)
        });
    }

    private renewPreviewSignal(): AbortSignal {
        this.previewAbortController?.abort();

        const controller = new AbortController();
        this.previewAbortController = controller;
        this.previewSignal = controller.signal;
        return controller.signal;
    }

    private newPostWithData(preData: GalleryPreData, historySkip?: boolean): void {
        if (!this.frame) return;
        const frm = this.frame;

        const bodyFrame = frm.frames[0];
        const commentFrame = frm.frames[1];

        if (bodyFrame.data.load) return;

        const signal = this.renewPreviewSignal();
        const params = new URLSearchParams(preData.link);
        params.set("no", preData.id);
        preData.link = decodeURIComponent(params.toString());

        preData.title = "로딩 중...";
        bodyFrame.contents = "로딩 중...";

        this.buildBodyFrame(bodyFrame, preData, signal, historySkip);
        this.buildCommentFrame(commentFrame, preData, signal);

        if (this.status.toggleAdminPanel && document.querySelector(".useradmin_btnbox button")) {
            panel.admin(preData, frm, this.status.toggleBlur, eventBus, this.status.useKeyPress, previewRequest);
        }
    }

    private getAdjacentPostNo(direction: "next" | "prev"): string | undefined {
        const currentId = this.postFetchedDataRef.value?.id;
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

    private previewFrame(ev: MouseEvent | null, prd?: GalleryPreData, historySkip?: boolean): void {
        if (this.preventOpen) {
            this.preventOpen = false;
            return;
        }

        if ((ev?.target as HTMLElement)?.closest(".ub-writer")) {
            return;
        }

        if (this.status.tooltipMode) miniPreviewClose(this.miniPreview, this.status.tooltipMode);

        const preData = ev === null ? prd : getRelevantData(ev);
        if (!preData) return;
        this.currentPreData = preData;

        let collapseView = false;
        if (ev?.target instanceof HTMLElement) {
            collapseView = ev.target.className.includes("reply_num");
        }

        if (!historySkip) {
            this.titleStore = document.title;
            this.urlStore = location.href;
        }

        const signal = this.renewPreviewSignal();

        const frm = this.frame ?? this.setupFrameOnce(preData, historySkip);

        frm.app.closed = false;
        this.frameClosed = false;
        frm.frames[0].collapse = collapseView;

        this.buildBodyFrame(frm.frames[0], preData, signal, historySkip);
        this.buildCommentFrame(frm.frames[1], preData, signal);

        if (this.status.toggleAdminPanel && document.querySelector(".useradmin_btnbox button") !== null) {
            panel.admin(preData, frm, this.status.toggleBlur, eventBus, this.status.useKeyPress, previewRequest);
        }

        setTimeout(frm.app.fadeIn, 0);

        ev?.preventDefault();
    }

    private setupFrameOnce(preData: GalleryPreData, historySkip?: boolean): Frame {
        const detector = new ScrollDetection();

        this.frame = new Frame(
            [
                {relative: true, center: true, preview: true, blur: this.status.toggleBlur},
                {relative: true, center: true, preview: true, blur: this.status.toggleBlur}
            ],
            {
                background: true,
                onScroll: (ev: WheelEvent, group: HTMLElement) => {
                    if (!this.status.scrollToSkip) return;

                    this.appStore = this.frame?.app;
                    this.groupStore = group;

                    detector.addMouseEvent(ev);
                },
                blur: this.status.toggleBackgroundBlur
            }
        );

        detector.listen("scroll", (ev: WheelEvent) => this.handleScrollSkip(ev, preData, historySkip));

        this.previewNavigationKeyDown = (keyboardEvent: KeyboardEvent) =>
            this.handleNavigationKey(keyboardEvent, historySkip);
        document.addEventListener("keydown", this.previewNavigationKeyDown);

        this.frame.app?.onClose(() => this.handleFrameClose());

        return this.frame;
    }

    private handleScrollSkip(ev: WheelEvent, preData: GalleryPreData | null, historySkip?: boolean): void {
        const scrolledTop = this.groupStore.scrollTop === 0;
        const scroll = Math.floor(this.groupStore.scrollHeight - this.groupStore.scrollTop);
        const scrolledToBottom = Math.abs(scroll - this.groupStore.clientHeight) < 2;

        if (!scrolledTop && !scrolledToBottom) {
            this.scrolledCount = 0;
        }

        if (ev.deltaY < 0) {
            this.appStore?.setScrollMode("top");

            if (!scrolledTop) {
                this.appStore?.clearScrollMode();
            }

            if (!scrolledTop || !preData) return;

            if (this.scrolledCount++ < 1) return;
            this.scrolledCount = 0;

            preData.id = this.getAdjacentPostNo("prev") || (Number(this.getPostFetchedId()) - 1).toString();
            this.newPostWithData(preData, historySkip);
            this.groupStore.scrollTop = 0;

            this.appStore?.clearScrollMode();
        } else {
            this.appStore?.setScrollMode("bottom");

            if (!scrolledToBottom) {
                this.appStore?.clearScrollMode();
            }

            if (!scrolledToBottom || !preData) {
                return;
            }

            if (this.scrolledCount++ < 1) return;
            this.scrolledCount = 0;

            preData.id = this.getAdjacentPostNo("next") || (Number(this.getPostFetchedId()) + 1).toString();
            this.newPostWithData(preData, historySkip);

            this.groupStore.scrollTop = 0;
            this.appStore?.clearScrollMode();
        }
    }

    private handleNavigationKey(keyboardEvent: KeyboardEvent, historySkip?: boolean): void {
        if (keyboardEvent.key !== "PageUp" && keyboardEvent.key !== "PageDown") return;
        if (!this.currentPreData || this.frame?.app?.closed || this.frame?.app?.inputFocus) return;

        keyboardEvent.preventDefault();

        const isPageUp = keyboardEvent.key === "PageUp";
        const currentId = this.postFetchedDataRef.value?.id;
        const fallbackId = currentId ? (Number(currentId) + (isPageUp ? -1 : 1)).toString() : "";
        const nextPostNo = isPageUp
            ? this.getAdjacentPostNo("prev") || fallbackId
            : this.getAdjacentPostNo("next") || fallbackId;

        this.currentPreData.id = nextPostNo;
        this.newPostWithData(this.currentPreData, historySkip);

        if (this.groupStore) {
            this.groupStore.scrollTop = 0;
        }

        this.appStore?.clearScrollMode();
    }

    private handleFrameClose(): void {
        if (this.frameClosed) return;
        this.frameClosed = true;

        this.previewAbortController?.abort();
        this.previewAbortController = null;
        this.previewSignal = null;

        closeAllPopups();
        if (this.previewNavigationKeyDown) {
            document.removeEventListener("keydown", this.previewNavigationKeyDown);
            this.previewNavigationKeyDown = null;
        }

        if (!this.historyClose && this.titleStore) {
            history.pushState(null, this.titleStore, this.urlStore);
        }

        this.historyClose = false;

        if (this.titleStore) {
            document.title = this.titleStore;
        }

        this.appStore?.clearScrollMode();
        if (this.refreshIntervalId) window.clearInterval(this.refreshIntervalId);
    }

    private handleMousePress(ev: MouseEvent): void {
        if (ev.button !== 2) return;

        if (ev.type === "mousedown") {
            this.lastPress = Date.now();
            return;
        }

        if (
            ev.type === "mouseup" &&
            this.lastPress > 0 &&
            Date.now() - this.status.longPressDelay > this.lastPress
        ) {
            this.preventOpen = true;
            this.lastPress = 0;
        }
    }

    private addHandler(element: HTMLElement, handleMousePress: (ev: MouseEvent) => void, signal: AbortSignal): void {
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
        element.addEventListener(this.status.reversePreviewKey ? "click" : "contextmenu", (ev) => {
            if (element.closest(".us-post")?.classList.contains("refresherBlur")) return;

            if (typeof timer === "number") {
                window.clearTimeout(timer);
                timer = undefined;
            }

            this.previewFrame(ev);
        }, {signal});

        if (this.status.reversePreviewKey) {
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
                !this.status.tooltipMode ||
                element.closest(".us-post")?.classList.contains("refresherBlur") ||
                typeof timer === "number" ||
                (this.status.tooltipRatioDisable && element.closest(".us-post")?.querySelector(".ratio[style]"))
            )
                return;

            timer = window.setTimeout(() => {
                miniPreviewCreate(
                    this.miniPreview,
                    ev,
                    this.status.tooltipMode,
                    this.status.tooltipMediaHide,
                    this.status.tooltipInteraction,
                    getRelevantData,
                    this.postCaches,
                    previewRequest
                );

                if (this.status.tooltipInteraction)
                    miniPreviewMove(this.miniPreview, ev, this.status.tooltipMode, this.status.tooltipInteraction);
            }, this.status.tooltipDelay);
        }, {signal});

        element.addEventListener("mousemove", (ev) => {
            if (this.status.tooltipMode && !this.status.tooltipInteraction)
                miniPreviewMove(this.miniPreview, ev, this.status.tooltipMode, this.status.tooltipInteraction);
        }, {signal});

        element.addEventListener("mouseleave", () => {
            if (!this.status.tooltipMode) return;

            if (typeof timer === "number") {
                window.clearTimeout(timer);
                timer = undefined;
            }

            miniPreviewClose(this.miniPreview, this.status.tooltipMode);
        }, {signal});
    }

    private handlePopState(ev: PopStateEvent): void {
        if (!ev.state) {
            this.historyClose = true;

            try {
                this.frame?.app?.close();
            } catch {
                location.reload();
            }

            return;
        }

        this.historyClose = false;

        if (this.frame?.app?.closed) {
            this.previewFrame(null, ev.state.preData, true);
        } else {
            this.newPostWithData(ev.state.preData, true);
        }
    }
}