import {http} from "@/core/http/client";
import {mergeParamURL, queryString, view} from "@/core/http/urls";
import type {ModuleDefinition} from "@/core/module/types";
import {eventBus} from "@/core/eventbus/bus";
import {useUiStore} from "@/stores/ui";

const MINIMUM_REFRESH_INTERVAL = 2000;
const PAGING_SELECTOR = ".left_content article:has(.gall_listwrap) .bottom_paging_box";

// 제어 버튼 (revoke에서 제거 — setup/def-revoke가 공유)
let button: HTMLButtonElement | null = null;

interface RefreshApi {
    refreshLists(): Promise<void>;

    togglePause(): void;
}

/** 검색어 강조 (TreeWalker, 텍스트 노드만) */
const highlightSearchResults = (newList: HTMLElement, searchValue: string): void => {
    if (!searchValue) return;

    for (const gallTit of newList.querySelectorAll<HTMLElement>(".gall_tit")) {
        const anchor = gallTit.querySelector<HTMLElement>("a:first-child");
        if (!anchor) continue;

        const className = anchor.querySelector(".spoiler") ? "mark spoiler" : "mark";

        const walker = anchor.ownerDocument.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

        for (const node of textNodes) {
            const text = node.data;
            if (!text.includes(searchValue)) continue;

            const fragment = anchor.ownerDocument.createDocumentFragment();
            let index = 0;
            let found: number;

            while ((found = text.indexOf(searchValue, index)) !== -1) {
                fragment.append(text.slice(index, found));

                const span = anchor.ownerDocument.createElement("span");
                span.className = className;
                span.textContent = searchValue;
                fragment.append(span);

                index = found + searchValue.length;
            }

            fragment.append(text.slice(index));
            node.replaceWith(fragment);
        }
    }
};

const refreshModule: ModuleDefinition = {
    id: "refresh",
    name: "글 목록 새로고침",
    description: "글 목록을 자동으로 새로고침합니다.",
    urls: [/\/board\/(view|lists)/],
    defaultEnable: true,

    settings: {
        refreshRate: {
            type: "range",
            name: "새로고침 주기",
            desc: "글 목록을 새로고침하는 주기입니다.",
            default: 5000,
            min: 3000,
            max: 20000,
            step: 100,
            unit: "ms"
        },
        fadeIn: {
            type: "check",
            name: "새 게시글 효과",
            desc: "새로 추가된 게시글에 효과를 넣습니다.",
            default: true
        },
        useBetterBrowse: {
            type: "check",
            name: "인페이지 페이지 전환",
            desc: "페이지 이동시 새로고침을 끄지 않고 이동합니다.",
            default: true
        },
        noRefreshOnSearch: {
            type: "check",
            name: "검색 중 페이지 새로고침 안함",
            desc: "검색 중에는 자동 새로고침을 하지 않습니다.",
            default: true
        },
        doNotColorVisited: {
            type: "check",
            name: "방문 링크 색상 지정 비활성화",
            desc: "방문한 링크의 색상을 기본 색상으로 지정합니다.",
            default: false
        }
    },

    shortcuts: {
        refreshLists: (_ctx, api) => void (api as RefreshApi | undefined)?.refreshLists(),
        refreshPause: (_ctx, api) => (api as RefreshApi | undefined)?.togglePause()
    },

    setup(ctx) {
        let paused = Boolean(queryString("s_keyword") && ctx.settings.noRefreshOnSearch);
        let lastRefresh = 0;
        let loading = false;
        let timer = 0;
        let originalLocation = location.href;
        let calledByPageTurn = false;
        const paginationAbort = new AbortController();

        const updateButtonText = (): void => {
            if (button) button.textContent = paused ? "새로고침: 꺼짐" : "새로고침: 켜짐";
        };

        // 제어 버튼
        ctx.addFilter(
            ".page_head > .gall_issuebox",
            (element) => {
                if (element.querySelector("button[data-refresher-refresh]")) return;

                button = document.createElement("button");
                button.dataset.refresherRefresh = "true";
                button.textContent = paused ? "새로고침: 꺼짐" : "새로고침: 켜짐";
                button.addEventListener("click", () => {
                    paused = !paused;
                    button!.textContent = paused ? "새로고침: 꺼짐" : "새로고침: 켜짐";
                });
                element.append(button);
            },
            {neverExpire: true}
        );

        // 방문 링크 색상 (Firefox 대응)
        if (ctx.settings.doNotColorVisited) {
            document.documentElement.classList.add("refresherDoNotColorVisited");
        }

        // ===== load =====
        const load = async (customURL?: string, force?: boolean): Promise<boolean> => {
            if (loading || document.hidden) return false;
            if (!force && (Date.now() - lastRefresh < MINIMUM_REFRESH_INTERVAL || paused)) return false;

            const isAdmin = Boolean(document.querySelector(".useradmin_btnbox button"));
            if (isAdmin && document.querySelector<HTMLInputElement>(".article_chkbox:checked")) return false;
            if (document.querySelector(".user_data.add")) return false;

            const managerCheckbox = document.querySelector<HTMLTemplateElement>("#minor_td-tmpl[type=\"text/x-jquery-tmpl\"]")?.innerHTML ?? "";

            loading = true;

            try {
                if (customURL) originalLocation = customURL;

                lastRefresh = Date.now();

                const response = await http.get(view(originalLocation), {
                    timeout: Number(ctx.settings.refreshRate) - 100
                }).text();
                const dom = new DOMParser().parseFromString(response, "text/html");

                const oldList = document.querySelector<HTMLElement>(".gall_list:not([id]) tbody");
                const newList = dom.querySelector<HTMLElement>(".gall_list:not([id]) tbody");

                eventBus.emit("refresherGetPost", dom);

                if (!oldList || !newList) return false;

                // 현재 페이지 정보 (전환 지원을 위해 매 요청마다 계산)
                const currentUrl = new URL(originalLocation);
                const currentPostNo = currentUrl.searchParams.get("no");
                const isPageView = originalLocation.includes("/board/view");
                const searchType = currentUrl.searchParams.get("s_type");

                const oldRows = Array.from(oldList.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
                const oldCacheSet = new Set(oldRows.map((row) => row.dataset.no ?? (row.querySelector(".gall_num")?.textContent ?? "")));

                const newRows = Array.from(newList.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
                const newPostList: HTMLTableRowElement[] = [];

                for (const element of newRows) {
                    const no = element.dataset.no ?? (element.querySelector<HTMLElement>(".gall_num")?.textContent ?? "");

                    if (!isPageView && isAdmin) {
                        const shouldAddCheckbox =
                            searchType !== "search_comment" || (searchType === "search_comment" && element.classList.contains("search_comment"));

                        if (shouldAddCheckbox) {
                            element.insertAdjacentHTML("afterbegin", no === "설문" ? "<td></td>" : managerCheckbox);
                        }
                    }

                    if (isPageView && no === currentPostNo) {
                        element.classList.add("crt");
                        const gallNum = element.querySelector<HTMLElement>(".gall_num");
                        if (gallNum) gallNum.innerHTML = "<span class=\"sp_img crt_icon\"> </span>";
                        continue;
                    }

                    if (!oldCacheSet.has(no)) newPostList.push(element);
                }

                if (calledByPageTurn) {
                    calledByPageTurn = false;

                    if (queryString("s_keyword")) {
                        const searchValue = document.querySelector<HTMLInputElement>("#sch_q")?.value ?? "";
                        highlightSearchResults(newList, searchValue);
                    }
                } else if (ctx.settings.fadeIn) {
                    newPostList.forEach((element, index) => {
                        element.classList.add("refresherNewPost");
                        element.style.animationDelay = `${(newPostList.length - index) * 50}ms`;
                    });
                }

                // 미리보기 모듈의 삭제글 보존(M4): modules.use("preview")의 archive 기능 사용

                oldList.replaceWith(newList);

                if (newPostList.length > 0) eventBus.emit("newPostList", newPostList);

                return true;
            } catch (error) {
                console.error("Refresh failed:", error);
                return false;
            } finally {
                loading = false;
            }
        };

        // ===== 스케줄링: 즉시 1회 → 주기+지터 재귀 =====
        const armNext = (): void => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                void load();
                armNext();
            }, Number(ctx.settings.refreshRate) + 500 + Math.random() * 1500);
        };

        void load();
        armNext();

        const onVisibilityChange = (): void => {
            if (document.hidden) {
                window.clearTimeout(timer);
                return;
            }

            void load();
            armNext();
        };

        const onPageShow = (event: PageTransitionEvent): void => {
            if (!event.persisted) void load();
        };

        const onPopState = (): void => {
            calledByPageTurn = true;
            window.clearTimeout(timer);
            void load(undefined, true);
            armNext();
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("pageshow", onPageShow);
        window.addEventListener("popstate", onPopState);

        const offRefreshRequest = eventBus.on("refreshRequest", async () => {
            window.clearTimeout(timer);
            await load(undefined, true);
            armNext();
        });

        ctx.addCleanup(() => {
            offRefreshRequest();
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pageshow", onPageShow);
            window.removeEventListener("popstate", onPopState);
            window.clearTimeout(timer);
            paginationAbort.abort();
        });

        // ===== 인페이지 페이지 전환 =====
        if (ctx.settings.useBetterBrowse) {
            ctx.addFilter(
                `${PAGING_SELECTOR} a:not([data-refresher-paged])`,
                (anchor) => {
                    if (!(anchor instanceof HTMLAnchorElement)) return;

                    anchor.dataset.refresherPaged = "true";
                    if (anchor.getAttribute("href")?.startsWith("javascript:")) return;

                    anchor.addEventListener(
                        "click",
                        (event) => {
                            event.preventDefault();

                            const isPageView = location.href.includes("/board/view");
                            const newUrl = isPageView ? mergeParamURL(location.href, anchor.href) : anchor.href;

                            history.pushState(null, document.title, newUrl);
                            calledByPageTurn = true;

                            void (async () => {
                                if (!(await load(location.href, true))) return;

                                const scrollTarget = document.querySelector(isPageView ? ".view_bottom_btnbox" : ".page_head");
                                scrollTarget?.scrollIntoView({behavior: "smooth", block: "start"});
                            })();
                        },
                        {signal: paginationAbort.signal}
                    );
                },
                {neverExpire: true}
            );
        }

        // ===== 페이징 박스 갱신 (refresherGetPost) =====
        eventBus.on("refresherGetPost", ({data: dom}) => {
            const source = dom.querySelector<HTMLElement>(PAGING_SELECTOR);
            const destination = document.querySelector<HTMLElement>(PAGING_SELECTOR);
            if (source && destination && source.innerHTML !== destination.innerHTML) {
                destination.innerHTML = source.innerHTML;
            }
        });

        const api: RefreshApi = {
            refreshLists: async () => {
                if (Date.now() - lastRefresh < MINIMUM_REFRESH_INTERVAL) {
                    useUiStore.getState().showToast("너무 자주 새로고칠 수 없습니다.");
                    return;
                }

                await load();
            },

            togglePause: () => {
                paused = !paused;
                if (button) button.textContent = paused ? "새로고침: 꺼짐" : "새로고침: 켜짐";

                useUiStore.getState().showToast(paused ? "이번 페이지에서는 새로고침을 사용하지 않습니다." : "이번 페이지에서는 새로고침을 사용합니다.");
            }
        };

        return api;
    },

    revoke() {
        if (button) {
            button.remove();
            button = null;
        }

        document.documentElement.classList.remove("refresherDoNotColorVisited");

        for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[data-refresher-paged]")) {
            anchor.onclick = null;
            delete anchor.dataset.refresherPaged;
        }
    }
};

export default refreshModule;
