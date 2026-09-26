import {http} from "@/core/http/client";
import {isViewPage, listUrl, mergeParamURL, pagePostNo, queryString, rowPostNo} from "@/core/http/urls";
import {defineModule} from "@/core/module/define";
import type {ModuleContext} from "@/core/module/types";
import {eventBus} from "@/core/eventbus/bus";
import {sendMessage} from "@/core/messaging/protocol";
import {usePreviewStore} from "@/features/preview/ui/previewStore";
import {useUiStore} from "@/stores/ui";

const MINIMUM_REFRESH_INTERVAL = 2000;
/** 목록 요청이 연달아 실패할 때 자동 새로고침 주기를 늘리는 상한 */
const MAXIMUM_BACKOFF_INTERVAL = 60_000;
const LIST_SELECTOR = ".gall_list:not([id]) tbody";
const PAGING_SELECTOR = ".left_content article:has(.gall_listwrap) .bottom_paging_box";

/** setup()이 돌려주는 객체 — 단축키와 팝업이 쓴다 */
export interface RefreshApi {
    refreshLists(): Promise<void>;

    togglePause(): void;

    /** 지금 이 페이지에서 새로고침이 멈춰 있는지 */
    isPaused(): boolean;
}

/**
 * 관리자 목록 행의 체크박스 칸을 만드는 함수. 실제 마크업을 따르기 위해 기존 행의 칸을 복제해 글 번호만 바꾸고,
 * 그런 행이 없으면 디시의 행 템플릿(갤러리 종류별 *_td-tmpl), 그것도 없으면 빈 칸을 쓴다.
 * 번호 없는 행(설문/AD)은 빈 칸 — 열 정렬만 맞춘다.
 */
const checkboxCellFactory = (oldRows: HTMLTableRowElement[]): ((no: string | undefined) => HTMLTableCellElement) => {
    const sampleRow = oldRows.find((row) => row.dataset.no && row.querySelector(":scope > td .article_chkbox"));
    let sample = sampleRow?.querySelector<HTMLTableCellElement>(":scope > td:has(.article_chkbox)") ?? null;

    if (!sample) {
        const template = document.createElement("template");
        template.innerHTML = document.querySelector("script[type=\"text/x-jquery-tmpl\"][id$=\"_td-tmpl\"]")?.innerHTML.trim() ?? "";
        const cell = template.content.firstElementChild;
        sample = cell instanceof HTMLTableCellElement ? cell : null;
    }

    return (no) => {
        if (!no || !sample) return document.createElement("td");

        const cell = sample.cloneNode(true) as HTMLTableCellElement;
        const input = cell.querySelector<HTMLInputElement>("input");
        if (input) {
            input.checked = false;
            if (sampleRow?.dataset.no && input.value === sampleRow.dataset.no) input.value = no;
        }
        return cell;
    };
};

/** 새 글 판정용 행 키. 번호 없는 행(설문·AD, 다른 갤러리 공지)은 번호 칸 글자로 구분한다 */
const rowKey = (row: HTMLElement): string => rowPostNo(row) ?? row.querySelector(".gall_num")?.textContent ?? "";

/** 방문 링크 색상 (Firefox 대응) */
const applyDoNotColorVisited = (ctx: ModuleContext): void => {
    document.documentElement.classList.toggle("refresherDoNotColorVisited", ctx.settings.doNotColorVisited === true);
};

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

export default defineModule({
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
            desc: "페이지 이동 시 새로고침을 끄지 않고 이동합니다.",
            default: true
        },
        noRefreshOnSearch: {
            type: "check",
            name: "검색 중 페이지 새로고침 안 함",
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
        // 강제 로드가 진행 중인 요청에 막혔을 때 끝난 뒤 한 번 더 받기 위한 표시
        let rerun = false;
        // 연달아 실패한 목록 요청 수 — 자동 새로고침 주기를 이만큼 두 배씩 늘린다
        let failures = 0;
        // 페이지를 넘긴 주소 — 그 목록으로 갈아끼운 직후 목록 위로 올린다 (진행 중인 요청에 막혀 나중에 받아도)
        let scrollAfter: string | null = null;
        // 진행 중인 목록 요청 — 주소가 바뀌면 끊는다
        let inflight: AbortController | null = null;
        // 지난번 갈아끼운 목록의 tbody HTML — 받은 것이 같으면 파싱·교체를 건너뛴다
        let lastListHtml = "";
        // 받아온 행의 원래 HTML (체크박스 칸·강조·효과를 입히기 전) — 순서가 같으면 바뀐 행만 갈아끼운다
        const rawRows = new WeakMap<Element, string>();
        // 목록 표가 화면 가까이 있는지 — 글 보기 아래 목록처럼 멀리 있으면 갈아끼워도 볼 수 없어 쉰다
        let listNear = true;
        const gallery = queryString("id") ?? "";

        // 제어 버튼
        let button: HTMLButtonElement | null = null;
        const label = (): string => (paused ? "새로고침: 꺼짐" : "새로고침: 켜짐");

        ctx.addFilter(
            ".page_head > .gall_issuebox",
            (element) => {
                if (element.querySelector("button[data-refresher-refresh]")) return;

                button = document.createElement("button");
                button.type = "button";
                button.dataset.refresherRefresh = "true";
                button.textContent = label();
                button.addEventListener("click", () => {
                    paused = !paused;
                    button!.textContent = label();
                });
                element.append(button);
            }
        );
        ctx.addCleanup(() => button?.remove());

        applyDoNotColorVisited(ctx);

        // ===== load =====
        const load = async (customURL?: string, force?: boolean): Promise<boolean> => {
            // 진행 중인 요청 등으로 이번 호출이 막혀도 다음 새로고침부터는 새 주소를 받도록 먼저 바꿔 둔다.
            // 진행 중인 응답은 지난 주소의 목록이라 어차피 버리니 끊는다 — finally가 새 주소로 다시 받는다
            if (customURL && customURL !== originalLocation) {
                originalLocation = customURL;
                inflight?.abort();
            }

            if (loading) {
                // 관리 동작 뒤 요청 등은 진행 중인 응답이 바뀌기 전 목록일 수 있어 끝난 뒤 다시 받는다 (자동 tick은 겹쳐도 무시)
                if (force) rerun = true;
                return false;
            }
            if (document.hidden) return false;
            if (!force && (Date.now() - lastRefresh < MINIMUM_REFRESH_INTERVAL || paused)) return false;

            // 자동 새로고침만 거르는 조건 — 사용자가 직접 한 새로고침·이동은 그대로 받는다
            if (!force) {
                // 새 글은 1페이지에만 들어온다. 뒤 페이지는 갈아끼울 때마다 행이 밀려 읽던 글이 다음 페이지로 사라질 뿐이다
                const page = new URL(originalLocation).searchParams.get("page");
                if (page && page !== "1") return false;

                // 미리보기 뒤에서 갈아끼우면 행이 밀려 이전/다음 글이 바뀐다
                if (!listNear || usePreviewStore.getState().visible) return false;

                // 목록은 통째로 갈아끼워져 커서·키보드 포커스 아래 행이 바뀐다 — 그 위에 있는 동안은 건너뛴다.
                // 포커스는 :focus-visible만 본다: 글 제목을 마우스로 누르면 링크에 포커스가 남아 목록을 떠나도 계속 멈춘다
                const list = document.querySelector(LIST_SELECTOR);
                if (list && (list.matches(":hover") || list.querySelector(":focus-visible"))) return false;
            }

            // 관리자가 체크박스로 글을 고르는 중이면 목록을 갈아끼우지 않는다.
            // 댓글 체크박스는 목록과 상관없고, 사용자가 직접 한 이동(페이지 전환/뒤로 가기)은 막으면 주소와 목록이 어긋난다
            if (!customURL && (document.querySelector(".gall_list:not([id]) .article_chkbox:checked") || document.querySelector(".user_data.add"))) {
                return false;
            }

            loading = true;
            // 기다리는 동안 뒤로 가기/페이지 이동으로 originalLocation이 바뀔 수 있으니 요청한 주소를 고정
            const target = originalLocation;
            const controller = new AbortController();
            inflight = controller;

            const fail = (): false => {
                failures++;
                // 사용자가 한 이동·새로고침은 실패하면 주소만 바뀌고 목록은 그대로라 알린다
                if (force) useUiStore.getState().showToast("글 목록을 불러오지 못했습니다.", "error");
                return false;
            };

            try {
                lastRefresh = Date.now();

                // 자동 새로고침만 주기보다 짧게 끊고 재시도하지 않는다 — 실패는 armNext가 주기를 늘려 받는다 (ky 재시도는 Retry-After를 끝없이 기다려 페이지 넘김까지 막는다).
                // 사용자가 한 이동은 느린 검색 결과도 기다린다 (timeout: undefined는 기본값을 덮으니 빼야 한다)
                const response = await http.get(listUrl(target), {
                    signal: controller.signal,
                    ...(force ? {} : {timeout: Number(ctx.settings.refreshRate) - 100, retry: 0})
                }).text();
                // 그 사이 주소가 바뀌었으면 지난 주소의 목록이라 버린다 — finally에서 새 주소로 다시 받는다
                if (target !== originalLocation) return false;

                // 목록이 그대로면 파싱·교체를 건너뛴다. 응답 전체는 요청마다 바뀌는 값(s_key)이 있어 tbody만 비교한다
                const start = response.indexOf("<tbody");
                const listHtml = start === -1 ? "" : response.slice(start, response.indexOf("</tbody>", start));
                if (!customURL && listHtml && listHtml === lastListHtml) {
                    failures = 0;
                    return true;
                }

                const dom = new DOMParser().parseFromString(response, "text/html");

                const oldList = document.querySelector<HTMLElement>(LIST_SELECTOR);
                const newList = dom.querySelector<HTMLElement>(LIST_SELECTOR);

                // 페이징 박스도 받아온 것으로 맞춘다. 같을 땐 건드리지 않아야 누르던 페이지 링크가 교체로 사라지지 않는다
                const paging = dom.querySelector<HTMLElement>(PAGING_SELECTOR);
                const currentPaging = document.querySelector<HTMLElement>(PAGING_SELECTOR);
                if (paging && currentPaging && paging.innerHTML !== currentPaging.innerHTML) currentPaging.innerHTML = paging.innerHTML;

                // 목록 없는 응답(오류·차단 안내 페이지)도 실패로 쳐서 주기를 늘린다
                if (!oldList || !newList) return fail();
                failures = 0;

                const searchType = new URL(target).searchParams.get("s_type");

                const oldRows = Array.from(oldList.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
                const oldKeys = oldRows.map(rowKey);
                const oldCacheSet = new Set(oldKeys);

                const newRows = Array.from(newList.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
                const newKeys = newRows.map(rowKey);
                const newPostList: HTMLTableRowElement[] = [];

                // 관리자 목록은 머리에 체크박스 열이 있는데, 받아온 행엔 그 칸이 없다(디시 JS가 나중에 붙임) — 없으면 열이 한 칸씩 밀린다
                const hasCheckboxColumn = Boolean(oldList.closest("table")?.querySelector("thead .chkbox_th"));
                const checkboxCell = hasCheckboxColumn ? checkboxCellFactory(oldRows) : null;

                for (const [index, element] of newRows.entries()) {
                    const no = newKeys[index]!;
                    rawRows.set(element, element.outerHTML);

                    if (checkboxCell && !element.querySelector(".article_chkbox")) {
                        // 댓글 검색 결과에선 댓글 행에만 체크박스가 있다
                        if (searchType !== "search_comment" || element.classList.contains("search_comment")) {
                            element.prepend(checkboxCell(element.dataset.no));
                        }
                    }

                    if (isViewPage && no === pagePostNo) {
                        element.classList.add("crt");
                        const gallNum = element.querySelector<HTMLElement>(".gall_num");
                        if (gallNum) gallNum.innerHTML = "<span class=\"sp_img crt_icon\"> </span>";
                        continue;
                    }

                    if (!oldCacheSet.has(no)) newPostList.push(element);
                }

                // 받아온 HTML엔 검색어 강조가 없으니 페이지 전환뿐 아니라 받아온 목록마다 칠한다
                if (queryString("s_keyword")) {
                    const searchValue = document.querySelector<HTMLInputElement>("#sch_q")?.value ?? "";
                    highlightSearchResults(newList, searchValue);
                }

                // 주소를 바꾼 로드(페이지 넘김·뒤로 가기)는 다른 목록이라 새 글 효과를 넣지 않는다
                if (!customURL && ctx.settings.fadeIn) {
                    for (const [index, element] of newPostList.entries()) {
                        element.classList.add("refresherNewPost");
                        // 새 행이 많아도 마지막 행이 한참 뒤에 나타나지 않게 지연에 상한을 둔다
                        element.style.animationDelay = `${Math.min(newPostList.length - index, 10) * 50}ms`;
                    }
                }

                // 미리보기 모듈의 삭제글 보존(archiveArticle)은 캐시에 이미 반영됨

                // 행 순서가 같으면 바뀐 행(조회수 등)만 갈아끼운다 — 그대로인 행은 hover·리스너가 남는다.
                // 검색 결과는 강조와 글·댓글 행 짝이 얽혀 통째로 바꾼다
                const sameOrder = !customURL && !queryString("s_keyword") && oldKeys.length === newKeys.length && oldKeys.every((key, index) => key === newKeys[index]);
                if (sameOrder) {
                    for (const [index, row] of oldRows.entries()) {
                        const next = newRows[index]!;
                        if (rawRows.get(row) !== rawRows.get(next)) row.replaceWith(next);
                    }
                } else {
                    oldList.replaceWith(newList);
                }
                lastListHtml = listHtml;
                // 디시는 자체 차단·이용자 메모 배지를 로드 때 한 번만 건다 — 갈아끼운 행엔 페이지 스크립트로 다시 건다 (콘텐츠 스크립트에선 못 부른다)
                void sendMessage("refresher:listReplaced", gallery).catch(() => {});

                if (target === scrollAfter) {
                    scrollAfter = null;
                    document.querySelector(isViewPage ? ".view_bottom_btnbox" : ".page_head")?.scrollIntoView({behavior: "smooth", block: "start"});
                }

                if (newPostList.length > 0) eventBus.emit("newPostList", newPostList);

                return true;
            } catch (e) {
                // 주소가 바뀌어 끊은 요청은 실패가 아니다 (파이어폭스에선 오류 종류로 가리기 어려워 신호로 본다)
                if (controller.signal.aborted) return false;
                console.error("Refresh failed:", e);
                return fail();
            } finally {
                loading = false;
                inflight = null;
                // 넘긴 페이지의 로드가 실패했거나 목록이 그대로여서 건너뛰었으면 올리기를 버린다 — 남기면 한참 뒤 자동 새로고침이 목록 위로 끌어올린다
                if (target === scrollAfter) scrollAfter = null;
                if (target !== originalLocation || rerun) {
                    rerun = false;
                    // 주소가 바뀐 건 사용자가 직접 이동한 것이라 그 주소를 넘겨 체크박스 가드를 건너뛰게 한다
                    void load(target !== originalLocation ? originalLocation : undefined, true);
                }
            }
        };

        // ===== 스케줄링: 주기+지터 재귀 (첫 요청도 한 주기 뒤 — 파싱 중인 목록을 곧바로 다시 받지 않는다) =====
        const armNext = (): void => {
            window.clearTimeout(timer);
            // 숨은 탭에선 쉰다 — 다시 보이면 onVisibilityChange가 이어 간다 (응답을 기다리던 중 숨겨져도 여기서 멈춘다).
            // 모듈을 끈 뒤 응답이 와도 타이머를 다시 걸지 않는다
            if (ctx.signal.aborted || document.hidden) return;

            // 실패가 이어지면 주기를 두 배씩 늘린다 (최대 60초). 성공하면 load가 failures를 0으로 되돌린다
            const interval = Math.min(Number(ctx.settings.refreshRate) * 2 ** failures, MAXIMUM_BACKOFF_INTERVAL);
            // 응답을 받은 뒤 다음 주기를 잡아야 방금 실패가 바로 반영된다
            timer = window.setTimeout(() => void load().finally(armNext), interval + 500 + Math.random() * 1500);
        };

        armNext();

        // 목록이 화면 가까이 돌아오면 쉬는 동안 밀린 목록을 바로 받는다
        const listObserver = new IntersectionObserver((entries) => {
            const wasNear = listNear;
            listNear = entries.at(-1)?.isIntersecting ?? true;
            if (listNear && !wasNear) void load();
        }, {rootMargin: "800px"});
        // 갈아끼우는 목록의 표만 본다 — 검색 페이지엔 아래쪽 통합검색 목록(.gall_listwrap, #kakao_seach_list)도 있어 그쪽 항목이 마지막에 오면 멀다고 잘못 본다
        ctx.addFilter(".gall_list:not([id])", (element) => listObserver.observe(element));
        ctx.addCleanup(() => listObserver.disconnect());

        const onVisibilityChange = (): void => {
            if (document.hidden) {
                window.clearTimeout(timer);
                return;
            }

            void load();
            armNext();
        };

        // 뒤로/앞으로 가기 — 인페이지 전환으로 쌓인 주소의 목록으로 되돌린다.
        // 미리보기가 쌓은 글 주소를 오가는 것은 같은 목록이다 — 다시 받으면 고르던 체크가 풀리고 일시정지를 무시한다
        const onPopState = (): void => {
            if (listUrl(location.href) === listUrl(originalLocation)) return;

            window.clearTimeout(timer);
            void load(location.href, true);
            armNext();
        };

        const {signal} = ctx;
        document.addEventListener("visibilitychange", onVisibilityChange, {signal});
        window.addEventListener("popstate", onPopState, {signal});

        eventBus.on("refreshRequest", async () => {
            window.clearTimeout(timer);
            await load(undefined, true);
            armNext();
        }, {signal});

        ctx.addCleanup(() => window.clearTimeout(timer));

        // ===== 인페이지 페이지 전환 =====
        // 앵커마다 붙이면 표시 속성 때문에 페이징 박스 비교가 늘 어긋나 매번 갈아끼우게 된다 — 문서에 하나만 위임한다
        const onPagingClick = (ev: MouseEvent): void => {
            // 수정키 클릭은 새 탭/창으로 열려는 것이라 가로채지 않는다
            if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
            if (!ctx.settings.useBetterBrowse) return;

            const anchor = ev.target instanceof Element ? ev.target.closest<HTMLAnchorElement>(`${PAGING_SELECTOR} a`) : null;
            if (!anchor || anchor.getAttribute("href")?.startsWith("javascript:")) return;

            ev.preventDefault();

            const newUrl = new URL(isViewPage ? mergeParamURL(location.href, anchor.href) : anchor.href, location.href).href;
            // 지금 페이지를 다시 누르면 기록을 쌓지 않는다
            if (newUrl !== location.href) history.pushState(null, document.title, newUrl);

            scrollAfter = newUrl;
            void load(newUrl, true);
        };

        document.addEventListener("click", onPagingClick, {signal});

        const api: RefreshApi = {
            refreshLists: async () => {
                if (Date.now() - lastRefresh < MINIMUM_REFRESH_INTERVAL) {
                    useUiStore.getState().showToast("너무 자주 새로고칠 수 없습니다.");
                    return;
                }

                // 명시적인 요청이라 일시정지(검색 중 기본값 포함)여도 받는다
                await load(undefined, true);
            },

            togglePause: () => {
                paused = !paused;
                if (button) button.textContent = label();

                useUiStore.getState().showToast(paused ? "이번 페이지에서는 새로고침을 사용하지 않습니다." : "이번 페이지에서는 새로고침을 사용합니다.");
            },

            isPaused: () => paused
        };

        return api;
    },

    onChanged(ctx, key) {
        if (key === "doNotColorVisited") applyDoNotColorVisited(ctx);
    },

    revoke() {
        document.documentElement.classList.remove("refresherDoNotColorVisited");
    }
});
