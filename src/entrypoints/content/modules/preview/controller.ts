import eventBus from "@/core/eventbus";
import filter from "@/core/filtering";
import modules from "@/core/modules";
import Frame, {type FrameScrollApi} from "./frame";
import type {PreviewFrame} from "./previewFrame";
import {makeBodyFrame, type PostFetchedDataRef} from "./bodyFrame";
import {makeCommentFrame} from "./commentFrame";
import {previewRequest} from "./request";
import {blockPreset, closeAllPopups, panel} from "./panel";
import {type MiniPreviewState} from "./miniPreview";
import {getRelevantData} from "./getRelevantData";
import type {PostCache} from "./cache";
import {ScrollDetection} from "./scrollDetection";
import {
    type PreviewInputContext,
    attachElementHandlers,
    createImageBlockClickHandler,
    createMousePressHandler
} from "./previewInputHandler";
import {
    type ScrollNavigationContext,
    createNavigationKeyHandler,
    createScrollSkipHandler
} from "./previewScrollNavigation";

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

    private readonly preventOpenRef = {value: false};
    private readonly lastPressRef = {value: 0};
    private historyClose = false;
    private frameClosed = false;
    private titleStore: string | null = null;
    private urlStore: string | null = null;

    private currentPreData: GalleryPreData | null = null;
    private readonly postFetchedDataRef: PostFetchedDataRef = {value: undefined};

    private appStore: FrameScrollApi | undefined;
    private groupStore!: HTMLElement;
    private readonly scrolledCountRef = {value: 0};

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

        const inputCtx: PreviewInputContext = {
            status: this.status,
            postCaches: this.postCaches,
            miniPreview: this.miniPreview,
            previewFrame: (ev, prd, historySkip) => this.previewFrame(ev, prd, historySkip),
            preventOpenRef: this.preventOpenRef,
            lastPressRef: this.lastPressRef
        };

        const handleMousePress = createMousePressHandler(inputCtx);

        this.filterUuid = filter.add(
            `.gall_list .ub-content${this.status.expandRecognizeRange ? "" : " .ub-word"}`,
            (element: HTMLElement) => attachElementHandlers(element, handleMousePress, elementEventSignal, inputCtx),
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
        const blockModule = modules.get("컨텐츠 차단");
        const blockStatus = blockModule?.status as { blur?: boolean; replyRemove?: boolean } | undefined;
        this.blurConfig = Boolean(blockStatus?.blur);
        this.replyConfig = Boolean(blockStatus?.replyRemove);

        const manageModule = modules.get("관리");
        const manageStatus = manageModule?.status as { enableGifControl?: boolean } | undefined;
        this.gifControlConfig = Boolean(manageStatus?.enableGifControl);
    }

    private setupImageBlockHandler(): void {
        this.imageBlockClickHandler = createImageBlockClickHandler();
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

    private previewFrame(ev: MouseEvent | null, prd?: GalleryPreData, historySkip?: boolean): void {
        if (this.preventOpenRef.value) {
            this.preventOpenRef.value = false;
            return;
        }

        if ((ev?.target as HTMLElement)?.closest(".ub-writer")) {
            return;
        }

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

        const scrollCtx: ScrollNavigationContext = {
            postFetchedDataRef: this.postFetchedDataRef,
            getAppStore: () => this.appStore,
            getGroupStore: () => this.groupStore,
            scrolledCountRef: this.scrolledCountRef,
            newPostWithData: (pd, hs) => this.newPostWithData(pd, hs),
            getPostFetchedId: () => this.getPostFetchedId()
        };

        detector.listen("scroll", createScrollSkipHandler(scrollCtx, preData, historySkip));

        this.previewNavigationKeyDown = createNavigationKeyHandler(
            scrollCtx,
            () => this.currentPreData,
            () => this.frame?.app?.closed ?? true,
            () => this.frame?.app?.inputFocus ?? false,
            historySkip
        );
        document.addEventListener("keydown", this.previewNavigationKeyDown);

        this.frame.app?.onClose(() => this.handleFrameClose());

        return this.frame;
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