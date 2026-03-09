import $ from "cash-dom";
import {Cash} from "cash-dom/dist/cash";
import ky from "ky";

import {queryString} from "../utils/http";
import storage from "../utils/webStorage";
import toast from "../utils/toast";

const MINIMUM_REFRESH_INTERVAL = 500;
const DEFAULT_TIMEOUT_OFFSET = 100;

let PAUSE_REFRESH = false;

const updateRefreshText = (button?: HTMLElement) => {
    button ??= document.querySelector<HTMLElement>(".page_head .gall_issuebox button[data-refresher=true]");

    if (!button) return;

    const onOff = button.querySelector<HTMLSpanElement>("span");
    if (onOff) {
        onOff.innerHTML = PAUSE_REFRESH ? "꺼짐" : "켜짐";
    }
};

let archiveArticleConfig = false;

(async () => {
    archiveArticleConfig = (await storage.get<boolean>("미리보기.enable"))
        ? await storage.get<boolean>("미리보기.archiveArticle")
        : false;
})();

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
        load: null
    },
    enable: true,
    default_enable: true,
    settings: {
        refreshRate: {
            name: "새로고침 주기",
            desc: "페이지를 새로 고쳐 현재 페이지에 반영하는 주기입니다.",
            type: "range",
            default: 3000,
            min: 1000,
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
            PAUSE_REFRESH = !PAUSE_REFRESH;

            toast.show(
                PAUSE_REFRESH
                    ? "이번 페이지에서는 새로고침을 사용하지 않습니다."
                    : "이번 페이지에서 새로고침을 사용합니다.",
                "info",
                1000
            );
            updateRefreshText();
        }
    },
    require: ["http", "eventBus", "filter"],
    func(http, eventBus, filter) {
        if (this.status.doNotColorVisited) {
            $(document.documentElement).addClass("refresherDoNotColorVisited");
        }

        filter.add(".page_head .gall_issuebox", (element) => {
            if (element?.querySelector("button[data-refresher=true]"))
                return;

            const button = document.createElement("button");
            button.type = "button";
            button.dataset.refresher = "true";
            button.innerHTML = "새로고침: ";
            const onOff = document.createElement("span");
            onOff.innerHTML = "켜짐";
            button.onclick = () => {
                PAUSE_REFRESH = !PAUSE_REFRESH;
                updateRefreshText(button);
            };
            button.appendChild(onOff);
            updateRefreshText(button);
            element.appendChild(button);
        });

        const urlSearchParams = new URLSearchParams(location.href);
        const currentPostNo = urlSearchParams.get("no");
        const isPageView = location.href.includes("/board/view");

        const searchType = queryString("s_type");

        let originalLocation = location.href;

        if (this.status.noRefreshOnSearch && queryString("s_keyword")) {
            PAUSE_REFRESH = true;
            updateRefreshText();
        }

        this.memory.load = async (customURL?: string, force?: boolean): Promise<boolean> => {
            if (document.hidden) return false;

            if (!force && (Date.now() < this.memory.lastRefresh + MINIMUM_REFRESH_INTERVAL || PAUSE_REFRESH)) {
                return false;
            }

            const $userDataLyr = $("#user_data_lyr");

            if ($userDataLyr.length > 0 && $userDataLyr.css("display") !== "none") return false;

            const isAdmin = $(".useradmin_btnbox button").length > 0;

            if (isAdmin && $(".article_chkbox").filter(":checked").length > 0) return false;

            const managerCheckbox = $(`#minor_td-tmpl[type="text/x-jquery-tmpl"]`).html();

            this.memory.lastRefresh = Date.now();
            this.memory.new_counts = 0;

            if (customURL) originalLocation = customURL;

            const url = http.view(originalLocation);

            const response = await ky.get(url, {timeout: this.memory.delay - DEFAULT_TIMEOUT_OFFSET}).text();
            const dom = new DOMParser().parseFromString(response, "text/html");

            eventBus.emit("refresherGetPost", dom);

            const $oldList = $(".gall_list:not([id]) tbody");
            const $newList = $(dom.querySelector(".gall_list:not([id]) tbody"));
            const $newListChildren = $newList.children();

            if ($newListChildren.length === 0) return false;

            $oldList.parent().removeClass("empty");

            const newPostList: Cash[] = [];

            const extractPostNumber = (element: HTMLElement): string => {
                return element.dataset.no ?? element.querySelector<HTMLElement>(".gall_num")?.innerText ?? "";
            };

            const oldCache = Array.from($oldList.find(".ub-content")).map(extractPostNumber);
            const newCache = Array.from($newList.find(".ub-content")).map(extractPostNumber);

            for (const element of $newListChildren) {
                const $element = $(element);
                const no = $element.get(0)?.dataset.no || $element.find(".gall_num").text();

                if (!isPageView && isAdmin) {
                    const shouldAddCheckbox =
                        searchType !== "search_comment" ||
                        (searchType === "search_comment" && $element.hasClass("search_comment"));

                    if (shouldAddCheckbox) {
                        $element.prepend(no === "설문" ? "<td></td>" : managerCheckbox);
                    }
                }

                if (isPageView && no === currentPostNo) {
                    $element.addClass("crt>").find(".gall_num").html(`<span class="sp_img crt_icon"> </span>`);
                    continue;
                }

                if (!oldCache.includes(no)) {
                    newPostList.push($element);
                }
            }

            this.memory.new_counts = newPostList.length;

            if (this.memory.calledByPageTurn) {
                this.memory.calledByPageTurn = false;

                if (queryString("s_keyword")) {
                    const searchValue = $("#sch_q").val() as string;

                    if (searchValue) {
                        $newListChildren.find(".gall_tit").each((_, element) => {
                            const $element = $(element);
                            const $a = $element.find("a:first-child");

                            let classList = "mark";
                            if ($a.find(".spoiler").length) {
                                classList += " spoiler";
                            }

                            const subject = $a.html();
                            if (subject.includes(searchValue)) {
                                $a.html(
                                    subject.replace(searchValue, `<span class="${classList}">${searchValue}</span>`)
                                );
                            }
                        });
                    }
                }
            } else {
                if (this.status.fadeIn) {
                    newPostList.forEach(($element, index) => {
                        $element.addClass("refresherNewPost");
                        $element.css("animation-delay", `${(newPostList.length - index) * 50}ms`);
                    });
                }

                if (archiveArticleConfig) {
                    const deletedPosts = oldCache.filter((postNo) => postNo && !newCache.includes(postNo));

                    deletedPosts.forEach((deletedNo) => {
                        const originalIndex = oldCache.indexOf(deletedNo);
                        if (originalIndex !== -1) {
                            const insertIndex = originalIndex + newPostList.length;
                            $newListChildren
                                .eq(insertIndex)
                                .before($oldList.children().eq(originalIndex).addClass("refresher-deleted"));
                        }
                    });
                }
            }

            $oldList.replaceWith($newList);

            if (newPostList.length) eventBus.emit("newPostList", newPostList);
            eventBus.emit("refresh");

            return true;
        };

        const scheduleNextRefresh = (skipLoad = false) => {
            if (!skipLoad) this.memory.load?.();

            if (this.memory.refresh) window.clearTimeout(this.memory.refresh);

            this.memory.delay = this.status.refreshRate + Math.floor(Math.random() * (1000 - 100) + 100);
            this.memory.refresh = window.setTimeout(scheduleNextRefresh, this.memory.delay);
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                scheduleNextRefresh();
                return;
            }

            if (this.memory.refresh) {
                window.clearTimeout(this.memory.refresh);
            }
        };

        const handlePageShow = (event: PageTransitionEvent) => {
            scheduleNextRefresh(!event.persisted);
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("pageshow", handlePageShow);

        scheduleNextRefresh(true);

        this.memory.refreshRequest = eventBus.on("refreshRequest", () => {
            if (this.memory.refresh) {
                window.clearTimeout(this.memory.refresh);
            }

            this.memory.load?.(undefined, true);
        });

        const handlePopState = () => {
            this.memory.calledByPageTurn = true;
            this.memory.load?.(undefined, true);
        };

        window.addEventListener("popstate", handlePopState);

        if (!this.status.useBetterBrowse) return;

        const handlePaginationClick = async (element: HTMLAnchorElement) => {
            if (element.href.includes("javascript:")) return;

            element.onclick = () => false;

            element.addEventListener("click", async () => {
                const isPageView = location.href.includes("/board/view");

                const newUrl = isPageView ? http.mergeParamURL(location.href, element.href) : element.href;

                history.pushState(null, document.title, newUrl);
                this.memory.calledByPageTurn = true;

                if (!(await this.memory.load?.(location.href, true))) return;

                const scrollTarget = document.querySelector(isPageView ? ".view_bottom_btnbox" : ".page_head");

                scrollTarget?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            });
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
                if (anchor.href.includes("javascript:")) return;

                anchor.onclick = () => false;

                anchor.addEventListener("click", async () => {
                    const isPageView = location.href.includes("/board/view");

                    const newUrl = isPageView ? http.mergeParamURL(location.href, anchor.href) : anchor.href;

                    history.pushState(null, document.title, newUrl);
                    this.memory.calledByPageTurn = true;

                    if (!(await this.memory.load?.(location.href, true))) return;

                    const scrollTarget = document.querySelector(isPageView ? ".view_bottom_btnbox" : ".page_head");

                    scrollTarget?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                });
            });
        };

        this.memory.uuid2 = eventBus.on("refresherGetPost", updatePagination);
    },
    revoke(_, eventBus, filter) {
        document.body.classList.remove("refresherDoNotColorVisited");

        if (this.memory.refresh) {
            window.clearTimeout(this.memory.refresh);
            this.memory.refresh = 0;
        }

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
        cache: object;
        new_counts: number;
        delay: number;
        refresh: number;
        calledByPageTurn: boolean;
        refreshRequest: string | null;
        lastRefresh: number;
        load: ((customURL?: string, force?: boolean) => Promise<boolean>) | null;
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
    require: ["http", "eventBus", "filter"];
}>;