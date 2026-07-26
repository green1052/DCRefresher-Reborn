import eventBus from "@/core/eventbus";
import http, {client, queryString} from "@/http/http";

export interface LoadFunctionContext {
    memory: {
        loading: boolean;
        lastRefresh: number;
        paused: boolean;
        new_counts: number;
        calledByPageTurn: boolean;
        delay: number;
        archiveArticleConfig: boolean;
    };
    status: {
        fadeIn: boolean;
    };
    currentPostNo: string | null;
    isPageView: boolean;
    searchType: string | null;
    getOriginalLocation: () => string;
    setOriginalLocation: (url: string) => void;
}

const MINIMUM_REFRESH_INTERVAL = 2000;
const DEFAULT_TIMEOUT_OFFSET = 100;

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightSearchResults = (newList: HTMLElement, searchValue: string): void => {
    if (!searchValue) return;
    const escaped = escapeRegex(searchValue);
    const regex = new RegExp(escaped, "g");
    for (const gallTit of newList.querySelectorAll<HTMLElement>(".gall_tit")) {
        const a = gallTit.querySelector<HTMLElement>("a:first-child");
        if (!a) continue;

        let classList = "mark";
        if (a.querySelector(".spoiler")) {
            classList += " spoiler";
        }

        a.innerHTML = a.innerHTML.replace(regex, `<span class="${classList}">${searchValue}</span>`);
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
    const newCacheSet = new Set(newCache);
    const deletedPosts = oldCache.filter((postNo) => postNo && !newCacheSet.has(postNo));

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

export function createLoadFunction(ctx: LoadFunctionContext): (customURL?: string, force?: boolean) => Promise<boolean> {
    return async (customURL?: string, force?: boolean): Promise<boolean> => {
        const memory = ctx.memory;
        if (memory.loading) return false;

        if (document.hidden) return false;

        memory.loading = true;

        try {
            if (Date.now() < memory.lastRefresh + MINIMUM_REFRESH_INTERVAL) {
                return false;
            }

            if (!force && memory.paused) {
                return false;
            }

            if (document.querySelector(".user_data.add")) return false;

            const isAdmin = !!document.querySelector(".useradmin_btnbox button");

            if (isAdmin && document.querySelector<HTMLInputElement>(".article_chkbox:checked")) return false;

            const managerCheckboxTpl = document.querySelector<HTMLTemplateElement>("#minor_td-tmpl[type=\"text/x-jquery-tmpl\"]");
            const managerCheckbox = managerCheckboxTpl?.innerHTML ?? "";

            memory.lastRefresh = Date.now();
            memory.new_counts = 0;

            let originalLocation = ctx.getOriginalLocation();
            if (customURL) {
                originalLocation = customURL;
                ctx.setOriginalLocation(customURL);
            }

            const url = http.view(originalLocation);

            const response = await client.get(url, {timeout: memory.delay - DEFAULT_TIMEOUT_OFFSET}).text();
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
            const oldCacheSet = new Set(oldCache);

            for (const element of newListChildren) {
                const no = element.dataset.no ?? (element.querySelector<HTMLElement>(".gall_num")?.textContent ?? "");

                if (!ctx.isPageView && isAdmin) {
                    const shouldAddCheckbox =
                        ctx.searchType !== "search_comment" ||
                        (ctx.searchType === "search_comment" && element.classList.contains("search_comment"));

                    if (shouldAddCheckbox) {
                        element.insertAdjacentHTML("afterbegin", no === "설문" ? "<td></td>" : managerCheckbox);
                    }
                }

                if (ctx.isPageView && no === ctx.currentPostNo) {
                    element.classList.add("crt");
                    const gallNum = element.querySelector<HTMLElement>(".gall_num");
                    if (gallNum) gallNum.innerHTML = `<span class="sp_img crt_icon"> </span>`;
                    continue;
                }

                if (!oldCacheSet.has(no)) {
                    newPostList.push(element);
                }
            }

            memory.new_counts = newPostList.length;

            if (memory.calledByPageTurn) {
                memory.calledByPageTurn = false;

                if (queryString("s_keyword")) {
                    const searchInput = document.querySelector<HTMLInputElement>("#sch_q");
                    const searchValue = searchInput?.value ?? "";
                    highlightSearchResults(newList, searchValue);
                }
            } else {
                if (ctx.status.fadeIn) {
                    newPostList.forEach((element, index) => {
                        element.classList.add("refresherNewPost");
                        element.style.animationDelay = `${(newPostList.length - index) * 50}ms`;
                    });
                }

                if (memory.archiveArticleConfig) {
                    archiveDeletedPosts(oldList, newList, newListChildren, oldCache, newCache, newPostList.length);
                }
            }

            oldList.replaceWith(newList);

            if (newPostList.length) eventBus.emit("newPostList", newPostList);

            return true;
        } finally {
            memory.loading = false;
        }
    };
}