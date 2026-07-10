import eventBus from "@/core/eventbus";
import filter from "@/core/filtering";
import ky from "../utils/httpClient";

import {queryString} from "../utils/http";
import toast from "../utils/toast";
import storage from "../utils/webStorage";

const MINIMUM_REFRESH_INTERVAL = 2000;
const DEFAULT_TIMEOUT_OFFSET = 100;

interface RefresherModuleMemory {
    uuid: string | null;
    uuid2: string | null;
    cache: Record<string, unknown>;
    new_counts: number;
    delay: number;
    refresh: number;
    calledByPageTurn: boolean;
    refreshRequest: string | null;
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

const highlightSearchResults = (newList: HTMLElement, searchValue: string): void => {
    if (!searchValue) return;
    for (const gallTit of newList.querySelectorAll<HTMLElement>(".gall_tit")) {
        const a = gallTit.querySelector<HTMLElement>("a:first-child");
        if (!a) continue;

        let classList = "mark";
        if (a.querySelector(".spoiler")) {
            classList += " spoiler";
        }

        const subject = a.innerHTML;
        if (subject.includes(searchValue)) {
            a.innerHTML = subject.replace(searchValue, `<span class="${classList}">${searchValue}</span>`);
        }
    }
};

const archiveDeletedPosts = (
    oldList: HTMLElement,
    newList: HTMLElement,
    newListChildren: HTMLElement[],
    oldCache: string[],
    newCache: string[],
    newPostCount: number
): void => {
    const deletedPosts = oldCache.filter((postNo) => postNo && !newCache.includes(postNo));

    deletedPosts.forEach((deletedNo) => {
        const originalIndex = oldCache.indexOf(deletedNo);
        if (originalIndex !== -1) {
            const insertIndex = originalIndex + newPostCount;
            const oldChild = oldList.children[originalIndex] as HTMLElement | undefined;
            if (oldChild) {
                oldChild.classList.add("refresher-deleted");
                const refChild = newListChildren[insertIndex] ?? null;
                newList.insertBefore(oldChild, refChild);
            }
        }
    });
};

const bindPaginationAnchor = (anchor: HTMLAnchorElement, memory: RefresherModuleMemory): void => {
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

export default {
    name: "글 목록 새로고침",
    description: "글 목록을 자동으로 새로고침합니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    memory: {
        uuid: null,
        uuid2: null,
        cache: {},
        new_counts: 0,
        delay: 3000,
        refresh: 0,
        calledByPageTurn: false,
        refreshRequest: "",
        lastRefresh: 0,
        load: null,
        paused: false,
        loading: false,
        archiveArticleConfig: false,
        controlButtonFilterId: null,
        visibilityChangeHandler: null,
        pageShowHandler: null,
        popStateHandler: null
    },
    enable: true,
    default_enable: true,
    settings: {
        refreshRate: {
            name: "새로고침 주기",
            desc: "페이지를 새로 고쳐 현재 페이지에 반영하는 주기입니다.",
            type: "range",
            default: 5000,
            min: 3000,
            max: 20000,
            step: 100,
            unit: "ms"
        },
        fadeIn: {
            name: "새 게시글 효과",
            desc: "새로 올라온 게시글에 서서히 등장하는 효과를 줍니다.",
            type: "check",
            default: true
        },
        useBetterBrowse: {
            name: "인페이지 페이지 전환",
            desc: "게시글 목록을 다른 페이지로 넘길 때 페이지를 새로 고치지 않고 넘길 수 있게 설정합니다.",
            type: "check",
            default: true
        },
        noRefreshOnSearch: {
            name: "검색 중 페이지 새로고침 안함",
            desc: "사이트 내부 검색 기능을 사용 중일시 새로고침을 사용하지 않습니다.",
            type: "check",
            default: true
        },
        doNotColorVisited: {
            name: "방문 링크 색상 지정 비활성화",
            desc: "Firefox와 같이 방문한 링크 색상 지정이 느린 브라우저에서 깜빡거리는 현상을 완화시킵니다.",
            type: "check",
            default: false
        }
    },
    shortcuts: {
        refreshLists() {
            if (this.memory.lastRefresh + MINIMUM_REFRESH_INTERVAL > Date.now()) {
                toast.show("너무 자주 새로고칠 수 없습니다.", "error", 1000);
                return;
            }

            this.memory.load?.();
        },
        refreshPause() {
            this.memory.paused = !this.memory.paused;

            toast.show(
                this.memory.paused
                    ? "이번 페이지에서는 새로고침을 사용하지 않습니다."
                    : "이번 페이지에서 새로고침을 사용합니다.",
                "info",
                1000
            );

            const button = document.querySelector<HTMLElement>(".page_head .gall_issuebox button[data-refresher=true]");
            if (button) {
                const onOff = button.querySelector<HTMLSpanElement>("span");
                if (onOff) onOff.innerHTML = this.memory.paused ? "꺼짐" : "켜짐";
            }
        }
    },
    async func() {
        const updateRefreshText = (button?: HTMLElement | null) => {
            button ??= document.querySelector<HTMLElement>(".page_head .gall_issuebox button[data-refresher=true]");

            if (!button) return;

            const onOff = button.querySelector<HTMLSpanElement>("span");
            if (onOff) {
                onOff.innerHTML = this.memory.paused ? "꺼짐" : "켜짐";
            }
        };

        this.memory.controlButtonFilterId = filter.add(".page_head > .gall_issuebox", (element) => {
            if (element?.querySelector("button[data-refresher=true]"))
                return;

            const button = document.createElement("button");
            button.type = "button";
            button.dataset.refresher = "true";
            button.innerHTML = "새로고침: ";
            const onOff = document.createElement("span");
            onOff.innerHTML = "켜짐";
            button.onclick = () => {
                this.memory.paused = !this.memory.paused;
                updateRefreshText(button);
            };
            button.appendChild(onOff);
            updateRefreshText(button);
            element.appendChild(button);
        });

        this.memory.archiveArticleConfig = (await storage.get<boolean>("미리보기.enable"))
            ? await storage.get<boolean>("미리보기.archiveArticle")
            : false;

        if (this.status.doNotColorVisited) {
            document.documentElement.classList.add("refresherDoNotColorVisited");
        }

        const urlSearchParams = new URLSearchParams(location.href);
        const currentPostNo = urlSearchParams.get("no");
        const isPageView = location.href.includes("/board/view");

        const searchType = queryString("s_type");

        let originalLocation = location.href;

        if (this.status.noRefreshOnSearch && queryString("s_keyword")) {
            this.memory.paused = true;
            updateRefreshText();
        }

        this.memory.load = async (customURL?: string, force?: boolean): Promise<boolean> => {
            if (this.memory.loading) return false;
            this.memory.loading = true;

            try {
                if (document.hidden) return false;

                if (Date.now() < this.memory.lastRefresh + MINIMUM_REFRESH_INTERVAL) {
                    return false;
                }

                if (!force && this.memory.paused) {
                    return false;
                }

                if (document.querySelector(".user_data.add")) return false;

                const isAdmin = !!document.querySelector(".useradmin_btnbox button");

                if (isAdmin && document.querySelector<HTMLInputElement>(".article_chkbox:checked")) return false;

                const managerCheckboxTpl = document.querySelector<HTMLTemplateElement>('#minor_td-tmpl[type="text/x-jquery-tmpl"]');
                const managerCheckbox = managerCheckboxTpl?.innerHTML ?? "";

                this.memory.lastRefresh = Date.now();
                this.memory.new_counts = 0;

                if (customURL) originalLocation = customURL;

                const url = http.view(originalLocation);

                const response = await ky.get(url, {timeout: this.memory.delay - DEFAULT_TIMEOUT_OFFSET}).text();
                const dom = new DOMParser().parseFromString(response, "text/html");

                eventBus.emit("refresherGetPost", dom);

                const oldList = document.querySelector<HTMLElement>(".gall_list:not([id]) tbody");
                const newList = dom.querySelector<HTMLElement>(".gall_list:not([id]) tbody");
                if (!oldList || !newList) return false;

                const newListChildren = Array.from(newList.children) as HTMLElement[];

                if (newListChildren.length === 0) return false;

                oldList.parentElement?.classList.remove("empty");

                const newPostList: HTMLElement[] = [];

                const extractPostNumber = (element: HTMLElement): string => {
                    return element.dataset.no ?? element.querySelector<HTMLElement>(".gall_num")?.innerText ?? "";
                };

                const oldCache = Array.from(oldList.querySelectorAll<HTMLElement>(".ub-content")).map(extractPostNumber);
                const newCache = Array.from(newList.querySelectorAll<HTMLElement>(".ub-content")).map(extractPostNumber);

                for (const element of newListChildren) {
                    const no = element.dataset.no ?? (element.querySelector<HTMLElement>(".gall_num")?.textContent ?? "");

                    if (!isPageView && isAdmin) {
                        const shouldAddCheckbox =
                            searchType !== "search_comment" ||
                            (searchType === "search_comment" && element.classList.contains("search_comment"));

                        if (shouldAddCheckbox) {
                            element.insertAdjacentHTML("afterbegin", no === "설문" ? "<td></td>" : managerCheckbox);
                        }
                    }

                    if (isPageView && no === currentPostNo) {
                        element.classList.add("crt>");
                        const gallNum = element.querySelector<HTMLElement>(".gall_num");
                        if (gallNum) gallNum.innerHTML = `<span class="sp_img crt_icon"> </span>`;
                        continue;
                    }

                    if (!oldCache.includes(no)) {
                        newPostList.push(element);
                    }
                }

                this.memory.new_counts = newPostList.length;

                if (this.memory.calledByPageTurn) {
                    this.memory.calledByPageTurn = false;

                    if (queryString("s_keyword")) {
                        const searchInput = document.querySelector<HTMLInputElement>("#sch_q");
                        const searchValue = searchInput?.value ?? "";
                        highlightSearchResults(newList, searchValue);
                    }
                } else {
                    if (this.status.fadeIn) {
                        newPostList.forEach((element, index) => {
                            element.classList.add("refresherNewPost");
                            element.style.animationDelay = `${(newPostList.length - index) * 50}ms`;
                        });
                    }

                    if (this.memory.archiveArticleConfig) {
                        archiveDeletedPosts(oldList, newList, newListChildren, oldCache, newCache, newPostList.length);
                    }
                }

                oldList.replaceWith(newList);

                if (newPostList.length) eventBus.emit("newPostList", newPostList);
                eventBus.emit("refresh");

                return true;
            } finally {
                this.memory.loading = false;
            }
        };

        const scheduleNextRefresh = (skipLoad = false) => {
            if (!skipLoad) this.memory.load?.();

            if (this.memory.refresh) window.clearTimeout(this.memory.refresh);

            this.memory.delay = this.status.refreshRate + Math.floor(Math.random() * (2000 - 500) + 500);
            this.memory.refresh = window.setTimeout(scheduleNextRefresh, this.memory.delay);
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                const timeSinceLastRefresh = Date.now() - this.memory.lastRefresh;
                if (timeSinceLastRefresh < MINIMUM_REFRESH_INTERVAL) {
                    scheduleNextRefresh(true);
                } else {
                    scheduleNextRefresh();
                }
                return;
            }

            if (this.memory.refresh) {
                window.clearTimeout(this.memory.refresh);
            }
        };

        const handlePageShow = (event: PageTransitionEvent) => {
            scheduleNextRefresh(!event.persisted);
        };

        this.memory.visibilityChangeHandler = handleVisibilityChange;
        this.memory.pageShowHandler = handlePageShow;

        document.addEventListener("visibilitychange", this.memory.visibilityChangeHandler);
        window.addEventListener("pageshow", this.memory.pageShowHandler);

        scheduleNextRefresh(true);

        this.memory.refreshRequest = eventBus.on("refreshRequest", () => {
            if (this.memory.refresh) {
                window.clearTimeout(this.memory.refresh);
            }

            this.memory.load?.(undefined, true);
        });

        const handlePopState = () => {
            if (this.memory.refresh) window.clearTimeout(this.memory.refresh);
            this.memory.calledByPageTurn = true;
            scheduleNextRefresh();
        };

        this.memory.popStateHandler = handlePopState;
        window.addEventListener("popstate", this.memory.popStateHandler);

        if (!this.status.useBetterBrowse) return;

        const handlePaginationClick = (element: HTMLAnchorElement) => {
            bindPaginationAnchor(element, this.memory);
        };

        this.memory.uuid = filter.add<HTMLAnchorElement>(
            ".left_content article:has(.gall_listwrap) .bottom_paging_box a",
            handlePaginationClick
        );

        const updatePagination = (parsedBody: Document) => {
            const pagingBox = parsedBody.querySelector(".left_content article:has(.gall_listwrap) .bottom_paging_box");
            const currentBottomPagingBox = document.querySelector(
                ".left_content article:has(.gall_listwrap) .bottom_paging_box"
            );

            if (currentBottomPagingBox && pagingBox) {
                currentBottomPagingBox.innerHTML = pagingBox.innerHTML;
            }

            const pagingBoxAnchors = document.querySelectorAll<HTMLAnchorElement>(
                ".left_content article:has(.gall_listwrap) .bottom_paging_box a"
            );

            pagingBoxAnchors.forEach((anchor) => {
                bindPaginationAnchor(anchor, this.memory);
            });
        };

        this.memory.uuid2 = eventBus.on("refresherGetPost", updatePagination);
    },
    revoke() {
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

        [this.memory.uuid, this.memory.uuid2, this.memory.refreshRequest].forEach((id, index) => {
            if (!id) return;

            if (index === 0) {
                filter.remove(id);
            } else {
                const eventName = index === 1 ? "refresherGetPost" : "refreshRequest";
                eventBus.remove(eventName, id);
            }
        });

        this.memory.uuid = null;
        this.memory.uuid2 = null;
        this.memory.refreshRequest = null;
        this.memory.load = null;
    }
} as RefresherModule<{
    memory: {
        uuid: string | null;
        uuid2: string | null;
        cache: Record<string, unknown>;
        new_counts: number;
        delay: number;
        refresh: number;
        calledByPageTurn: boolean;
        refreshRequest: string | null;
        lastRefresh: number;
        load: ((customURL?: string, force?: boolean) => Promise<boolean>) | null;
        paused: boolean;
        loading: boolean;
        archiveArticleConfig: boolean;
        controlButtonFilterId: string | null;
        visibilityChangeHandler: (() => void) | null;
        pageShowHandler: ((event: PageTransitionEvent) => void) | null;
        popStateHandler: (() => void) | null;
    };
    shortcuts: {
        refreshLists(): void;
        refreshPause(): void;
    };
    settings: {
        refreshRate: RefresherRangeSettings;
        fadeIn: RefresherCheckSettings;
        useBetterBrowse: RefresherCheckSettings;
        noRefreshOnSearch: RefresherCheckSettings;
        doNotColorVisited: RefresherCheckSettings;
    };
}>;
