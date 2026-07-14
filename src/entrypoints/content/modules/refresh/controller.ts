import eventBus from "@/core/eventbus";
import filter from "@/core/filtering";
import http, {queryString} from "@/http/http";
import {createLoadFunction} from "./load";
import {moduleEnableStorage, moduleSettingStorage} from "@/storage/wxtStorage";

const MINIMUM_REFRESH_INTERVAL = 2000;
const PAGING_SELECTOR = ".left_content article:has(.gall_listwrap) .bottom_paging_box";

export interface RefreshStatus {
    refreshRate: number;
    fadeIn: boolean;
    useBetterBrowse: boolean;
    noRefreshOnSearch: boolean;
    doNotColorVisited: boolean;
}

interface RefreshMemory {
    uuid: string | null;
    uuid2: (() => void) | null;
    refreshRequest: (() => void) | null;
    new_counts: number;
    delay: number;
    refresh: number;
    calledByPageTurn: boolean;
    lastRefresh: number;
    load: ((customURL?: string, force?: boolean) => Promise<boolean>) | null;
    paused: boolean;
    loading: boolean;
    archiveArticleConfig: boolean;
    controlButtonFilterId: string | null;
    visibilityChangeHandler: (() => void) | null;
    pageShowHandler: ((event: PageTransitionEvent) => void) | null;
    popStateHandler: (() => void) | null;
}

const bindPaginationAnchor = (anchor: HTMLAnchorElement, memory: RefreshMemory): void => {
    if (anchor.href.includes("javascript:")) return;

    anchor.onclick = () => false;

    anchor.addEventListener("click", async () => {
        const isPageView = location.href.includes("/board/view");
        const newUrl = isPageView ? http.mergeParamURL(location.href, anchor.href) : anchor.href;

        history.pushState(null, document.title, newUrl);
        memory.calledByPageTurn = true;

        if (memory.refresh) window.clearTimeout(memory.refresh);
        if (!(await memory.load?.(location.href, true))) return;

        const scrollTarget = document.querySelector(isPageView ? ".view_bottom_btnbox" : ".page_head");
        scrollTarget?.scrollIntoView({behavior: "smooth", block: "start"});
    });
};

export class RefreshController {
    private readonly status: RefreshStatus;
    private memory: RefreshMemory;
    private originalLocation: string;

    constructor(status: RefreshStatus) {
        this.status = status;
        this.originalLocation = location.href;
        this.memory = {
            uuid: null,
            uuid2: null,
            refreshRequest: null,
            new_counts: 0,
            delay: 3000,
            refresh: 0,
            calledByPageTurn: false,
            lastRefresh: 0,
            load: null,
            paused: false,
            loading: false,
            archiveArticleConfig: false,
            controlButtonFilterId: null,
            visibilityChangeHandler: null,
            pageShowHandler: null,
            popStateHandler: null
        };
    }

    async setup(): Promise<void> {
        this.setupControlButton();
        await this.loadArchiveConfig();

        if (this.status.doNotColorVisited) {
            document.documentElement.classList.add("refresherDoNotColorVisited");
        }

        const urlSearchParams = new URLSearchParams(location.href);
        const currentPostNo = urlSearchParams.get("no");
        const isPageView = location.href.includes("/board/view");
        const searchType = queryString("s_type");

        if (this.status.noRefreshOnSearch && queryString("s_keyword")) {
            this.memory.paused = true;
            this.updateRefreshText();
        }

        this.memory.load = createLoadFunction({
            memory: this.memory,
            status: this.status,
            currentPostNo,
            isPageView,
            searchType,
            getOriginalLocation: () => this.originalLocation,
            setOriginalLocation: (url: string) => {
                this.originalLocation = url;
            }
        });

        this.setupScheduling();
        this.setupRefreshRequestListener();
        this.setupPopStateHandler();

        if (this.status.useBetterBrowse) {
            this.setupPagination();
        }
    }

    refreshLists(): void {
        if (this.memory.lastRefresh + MINIMUM_REFRESH_INTERVAL > Date.now()) {
            toast.show("너무 자주 새로고칠 수 없습니다.", "error", 1000);
            return;
        }

        this.memory.load?.();
    }

    togglePause(): void {
        this.memory.paused = !this.memory.paused;

        toast.show(
            this.memory.paused
                ? "이번 페이지에서는 새로고침을 사용하지 않습니다."
                : "이번 페이지에서 새로고침을 사용합니다.",
            "info",
            1000
        );

        this.updateRefreshText();
    }

    destroy(): void {
        document.body.classList.remove("refresherDoNotColorVisited");

        if (this.memory.refresh) {
            window.clearTimeout(this.memory.refresh);
            this.memory.refresh = 0;
        }

        if (this.memory.visibilityChangeHandler) {
            document.removeEventListener("visibilitychange", this.memory.visibilityChangeHandler);
            this.memory.visibilityChangeHandler = null;
        }

        if (this.memory.pageShowHandler) {
            window.removeEventListener("pageshow", this.memory.pageShowHandler);
            this.memory.pageShowHandler = null;
        }

        if (this.memory.popStateHandler) {
            window.removeEventListener("popstate", this.memory.popStateHandler);
            this.memory.popStateHandler = null;
        }

        if (this.memory.controlButtonFilterId) {
            filter.remove(this.memory.controlButtonFilterId, true);
            this.memory.controlButtonFilterId = null;
        }

        document.querySelector(".page_head .gall_issuebox button[data-refresher=true]")?.remove();

        if (this.memory.uuid) {
            filter.remove(this.memory.uuid);
            this.memory.uuid = null;
        }

        if (this.memory.uuid2) {
            this.memory.uuid2();
            this.memory.uuid2 = null;
        }

        if (this.memory.refreshRequest) {
            this.memory.refreshRequest();
            this.memory.refreshRequest = null;
        }

        this.memory.load = null;
    }

    private updateRefreshText(button?: HTMLElement | null): void {
        button ??= document.querySelector<HTMLElement>(".page_head .gall_issuebox button[data-refresher=true]");

        if (!button) return;

        const onOff = button.querySelector<HTMLSpanElement>("span");
        if (onOff) {
            onOff.innerHTML = this.memory.paused ? "꺼짐" : "켜짐";
        }
    }

    private setupControlButton(): void {
        this.memory.controlButtonFilterId = filter.add(".page_head > .gall_issuebox", (element) => {
            if (element?.querySelector("button[data-refresher=true]")) return;

            const button = document.createElement("button");
            button.type = "button";
            button.dataset.refresher = "true";
            button.innerHTML = "새로고침: ";
            const onOff = document.createElement("span");
            onOff.innerHTML = "켜짐";
            button.onclick = () => {
                this.memory.paused = !this.memory.paused;
                this.updateRefreshText(button);
            };
            button.appendChild(onOff);
            this.updateRefreshText(button);
            element.appendChild(button);
        });
    }

    private async loadArchiveConfig(): Promise<void> {
        this.memory.archiveArticleConfig = (await moduleEnableStorage("미리보기").getValue())
            ? Boolean(await moduleSettingStorage("미리보기", "archiveArticle").getValue())
            : false;
    }

    private scheduleNextRefresh = (skipLoad = false): void => {
        if (!skipLoad) this.memory.load?.();

        if (this.memory.refresh) window.clearTimeout(this.memory.refresh);

        this.memory.delay = this.status.refreshRate + Math.floor(Math.random() * (2000 - 500) + 500);
        this.memory.refresh = window.setTimeout(this.scheduleNextRefresh, this.memory.delay);
    };

    private setupScheduling(): void {
        const handleVisibilityChange = (): void => {
            if (!document.hidden) {
                const timeSinceLastRefresh = Date.now() - this.memory.lastRefresh;
                if (timeSinceLastRefresh < MINIMUM_REFRESH_INTERVAL) {
                    this.scheduleNextRefresh(true);
                } else {
                    this.scheduleNextRefresh();
                }
                return;
            }

            if (this.memory.refresh) {
                window.clearTimeout(this.memory.refresh);
            }
        };

        const handlePageShow = (event: PageTransitionEvent): void => {
            this.scheduleNextRefresh(!event.persisted);
        };

        this.memory.visibilityChangeHandler = handleVisibilityChange;
        this.memory.pageShowHandler = handlePageShow;

        document.addEventListener("visibilitychange", this.memory.visibilityChangeHandler);
        window.addEventListener("pageshow", this.memory.pageShowHandler);

        this.scheduleNextRefresh(true);
    }

    private setupRefreshRequestListener(): void {
        this.memory.refreshRequest = eventBus.on("refreshRequest", () => {
            if (this.memory.refresh) {
                window.clearTimeout(this.memory.refresh);
            }

            this.memory.load?.(undefined, true);
        });
    }

    private setupPopStateHandler(): void {
        const handlePopState = (): void => {
            if (this.memory.refresh) window.clearTimeout(this.memory.refresh);
            this.memory.calledByPageTurn = true;
            this.scheduleNextRefresh();
        };

        this.memory.popStateHandler = handlePopState;
        window.addEventListener("popstate", this.memory.popStateHandler);
    }

    private setupPagination(): void {
        this.memory.uuid = filter.add<HTMLAnchorElement>(
            `${PAGING_SELECTOR} a`,
            (element) => bindPaginationAnchor(element, this.memory)
        );

        this.memory.uuid2 = eventBus.on("refresherGetPost", (parsedBody) => {
            const pagingBox = parsedBody.querySelector(PAGING_SELECTOR);
            const currentBottomPagingBox = document.querySelector(PAGING_SELECTOR);

            if (currentBottomPagingBox && pagingBox) {
                currentBottomPagingBox.innerHTML = pagingBox.innerHTML;
            }

            const pagingBoxAnchors = document.querySelectorAll<HTMLAnchorElement>(`${PAGING_SELECTOR} a`);

            pagingBoxAnchors.forEach((anchor) => {
                bindPaginationAnchor(anchor, this.memory);
            });
        });
    }
}