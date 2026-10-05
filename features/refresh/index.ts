import {BlockedError, http} from "@/core/http/client";
import {isViewPage, listUrl, mergeParamURL, queryString} from "@/core/http/urls";
import {LIST_SELECTOR, notifyListReplaced, PAGING_SELECTOR} from "@/core/list";
import {defineModule} from "@/core/module/define";
import {whenDomReady} from "@/utils/dom";
import {getModuleApi} from "@/core/module/registry";
import {ownPreviewEntry} from "@/core/preview/history";
import {useUiStore} from "@/stores/ui";
import {smoothScroll} from "@/utils/dom";

import {isWholeFirstPage, replaceList, syncPaging} from "./list";
import meta, {type Ctx, PAUSE_TOGGLE} from "./meta";
import {createUnseenCounter, setTitleCount} from "./title";

const MINIMUM_REFRESH_INTERVAL = 2000;
/** 목록 요청이 연달아 실패할 때 자동 새로고침 주기를 늘리는 상한. */
const MAXIMUM_BACKOFF_INTERVAL = 60_000;
/** 목록 요청 하나(차례 기다리기·응답 머리·본문)의 제한. 머리 제한(15초)에 수백 KB 본문을 받을 시간을 더했다. */
const LIST_TIMEOUT = 30_000;

/** setup()이 돌려주는 객체. 단축키·팝업·미리보기가 쓴다. */
interface RefreshApi {
    refreshLists(): Promise<void>;

    togglePause(): void;

    /** 지금 이 페이지에서 새로고침이 멈춰 있는지. */
    isPaused(): boolean;

    /** 목록을 곧바로 다시 받고 다음 주기를 새로 잡는다. 미리보기의 관리 동작(삭제·차단 등) 뒤에 부른다. */
    reload(): Promise<void>;
}

const applyDoNotColorVisited = (ctx: Ctx): void => {
    document.documentElement.classList.toggle("refresherDoNotColorVisited", ctx.settings.doNotColorVisited);
};

export default defineModule({
    ...meta,

    setup(ctx) {
        let paused = Boolean(queryString("s_keyword") && ctx.settings.noRefreshOnSearch);
        let lastRefresh = 0;
        let loading = false;
        let timer = 0;
        let originalLocation = location.href;
        // 강제 로드가 진행 중인 요청에 막혔으면 그 요청이 끝난 뒤 한 번 더 받는다.
        let rerun = false;
        // 연달아 실패한 목록 요청 수. 실패할 때마다 자동 새로고침 주기가 두 배가 된다.
        let failures = 0;
        // 페이지를 넘긴 주소. 그 목록으로 갈아끼운 직후 목록 위로 스크롤한다 (진행 중인 요청에 막혀 나중에 받아도).
        let scrollAfter: string | null = null;
        // 진행 중인 목록 요청. 주소가 바뀌면 끊는다.
        let inflight: AbortController | null = null;
        // 지난번 갈아끼운 목록의 tbody HTML. 받은 것이 같으면 파싱·교체를 건너뛴다.
        let lastListHtml = "";
        // 이 탭을 보지 않는 동안 들어온 새 글 수 (탭 제목에 붙인다).
        const unseen = createUnseenCounter(ctx);
        const gallery = queryString("id") ?? "";

        let button: HTMLButtonElement | null = null;
        const label = (): string => (paused ? "자동 새로고침: 꺼짐" : "자동 새로고침: 켜짐");
        // 버튼·단축키·팝업 토글이 같이 쓴다.
        const setPaused = (next: boolean): void => {
            paused = next;
            if (button) button.textContent = label();
        };

        // 페이지를 다 읽은 뒤에 넣는다. 읽는 중에 넣으면 파서가 이 칸에 버튼을 붙일 때마다 필터가 다시 불려 버튼을 끝으로 옮기고,
        // 그때마다 반쯤 읽은 페이지를 다시 배치해 목록 페이지를 여는 시간이 30ms 넘게 늘었다.
        whenDomReady(() => ctx.addFilter(
            ".page_head > .gall_issuebox",
            (element) => {
                // 버튼을 넣으면 이 칸에 필터가 다시 불린다. 이 실행의 버튼이면 그대로 둔다.
                // 죽은 인스턴스(파이어폭스 재주입)가 남긴 버튼은 눌러도 반응이 없어 갈아끼운다.
                if (button && element.contains(button)) return;
                element.querySelector("button[data-refresher-refresh]")?.remove();

                button = Object.assign(document.createElement("button"), {type: "button", textContent: label()});
                button.dataset.refresherRefresh = "true";
                button.addEventListener("click", () => setPaused(!paused));
                element.append(button);
            }
        ), ctx.signal);
        ctx.addCleanup(() => button?.remove());

        applyDoNotColorVisited(ctx);

        // ===== load =====
        const load = async (customURL?: string, force?: boolean): Promise<boolean> => {
            // 이번 호출이 막혀도 다음 새로고침부터 새 주소를 받도록 먼저 바꿔 둔다.
            // 진행 중인 응답은 지난 주소의 목록이라 어차피 버리니 끊는다. finally가 새 주소로 다시 받는다.
            if (customURL && customURL !== originalLocation) {
                originalLocation = customURL;
                inflight?.abort();
            }

            // 모듈을 끈 뒤 남은 타이머·재시도가 부른 것.
            if (ctx.signal.aborted) return false;

            if (loading) {
                // 강제 로드(관리 동작 뒤 등)는 진행 중인 응답이 바뀌기 전 목록일 수 있어 끝난 뒤 다시 받는다. 자동 새로고침은 겹치면 버린다.
                if (force) rerun = true;
                return false;
            }
            // 강제 로드는 숨긴 탭에서도 받는다. 진행 중인 요청 뒤로 미룬 강제 로드(rerun)가 그사이 탭을 옮겼다고 버려지면
            // 돌아왔을 때 자동 새로고침은 뒤 페이지·멈춤을 건너뛰어 지운 글이나 옛 페이지가 그대로 남는다.
            if (!force && document.hidden && !ctx.settings.backgroundRefresh) return false;
            if (!force && (Date.now() - lastRefresh < MINIMUM_REFRESH_INTERVAL || paused)) return false;

            // 자동 새로고침만 거르는 조건. 사용자가 직접 한 새로고침·이동은 그대로 받는다.
            if (!force) {
                // 새 글은 1페이지에만 들어온다. 뒤 페이지는 갈아끼워 봐야 행이 밀려 읽던 글이 다음 페이지로 사라질 뿐이다.
                const page = new URL(originalLocation).searchParams.get("page");
                if (page && page !== "1") return false;

                // 목록을 갈아끼우면 커서·키보드 포커스 아래 행이 바뀐다. 설정을 켜면 그 위에 있는 동안 건너뛴다.
                // 포커스는 :focus-visible만 본다. 글 제목을 마우스로 누르면 링크에 포커스가 남아, :focus로 보면 목록을 떠나도 계속 멈춘다.
                // 숨은 탭은 보지 않는다. 목록 위에서 탭을 옮기면 :hover가 남아 숨은 탭 새로고침이 끝내 돌지 않는다.
                const list = ctx.settings.pauseOnHover && !document.hidden ? document.querySelector(LIST_SELECTOR) : null;
                if (list && (list.matches(":hover") || list.querySelector(":focus-visible"))) return false;
            }

            // 관리자가 체크박스로 글을 고르는 중이거나 목록 행에 디시 유저 메뉴(작성자 좌클릭)가 열려 있으면 목록을 갈아끼우지 않는다.
            // 댓글의 체크박스·유저 메뉴는 목록과 상관없다. 문서 전체에서 찾으면 댓글 작성자 메뉴를 연 채로 두는 동안 새로고침이 멈춘다.
            // 사용자가 직접 한 이동(페이지 전환/뒤로 가기)은 막으면 주소와 목록이 어긋나므로 거르지 않는다.
            if (!customURL && document.querySelector(".gall_list:not([id]) :is(.article_chkbox:checked, .user_data.add)")) {
                return false;
            }

            loading = true;
            // 기다리는 동안 뒤로 가기·페이지 이동으로 originalLocation이 바뀔 수 있어 요청한 주소를 고정한다.
            const target = originalLocation;
            const controller = new AbortController();
            inflight = controller;

            const fail = (): false => {
                failures++;
                // 사용자가 한 이동·새로고침이 실패하면 주소만 바뀌고 목록은 그대로라 알린다.
                if (force) useUiStore.getState().showToast("글 목록을 불러오지 못했습니다.", "error");
                return false;
            };

            try {
                lastRefresh = Date.now();

                // 자동 새로고침은 재시도하지 않고, 실패하면 armNext가 주기를 늘린다. ky 재시도는 Retry-After를 최대 10초까지 기다려 그동안 목록 요청이 묶인다.
                // retry: undefined는 기본값을 덮으므로 키 자체를 뺀다.
                // 시간 제한을 주기보다 짧게 잡지 않는다. 큰 갤러리 목록(2~3초)이 조금만 늦어도 실패가 되어 주기가 1분까지 늘어난다.
                // http의 시간 제한(15초)은 응답 머리까지만 잰다. 디시 GET은 임시 차단 검사(detectBlocked)가 http.get 안에서 본문까지 읽어,
                // 본문이 멈추면 loading이 풀리지 않아 새로고침이 끝내 멈춘다. 그래서 요청 전체에 LIST_TIMEOUT을 걸고, 여기서 끊긴 것은 실패로 친다 (catch).
                const stalled = new AbortController();
                const stallTimer = window.setTimeout(() => stalled.abort(new DOMException("목록 요청 시간 초과", "TimeoutError")), LIST_TIMEOUT);
                let response: string;
                try {
                    response = await (await http.get(listUrl(target), {
                        signal: AbortSignal.any([controller.signal, stalled.signal]),
                        ...(force ? {} : {retry: 0})
                    })).text();
                } finally {
                    window.clearTimeout(stallTimer);
                }
                // 그사이 주소가 바뀌었으면 지난 주소의 목록이라 버린다. finally에서 새 주소로 다시 받는다.
                if (target !== originalLocation) return false;

                // 목록이 그대로면 파싱·교체를 건너뛴다. 응답 전체는 요청마다 바뀌는 값(s_key)이 있어 목록 표의 tbody만 비교한다.
                const table = response.indexOf("<table class=\"gall_list");
                const start = response.indexOf("<tbody", table);
                const end = start === -1 ? -1 : response.indexOf("</tbody>", start);
                // 잘린 응답(</tbody> 없음)은 비교·부분 파싱하지 않고 문서 전체를 파싱한다. slice(start, -1)은 문서 끝까지를 준다.
                const listHtml = end === -1 ? "" : response.slice(start, end);
                if (!customURL && listHtml && listHtml === lastListHtml) {
                    failures = 0;
                    return true;
                }

                // 자동 새로고침은 목록 표만 파싱한다 (문서 전체의 1/3). 페이징 박스는 사용자가 한 로드(강제·이동)에서만 맞춘다.
                // 검색 결과(검색 이어 보기가 페이징을 보고 다시 이어 붙인다)와 지난 요청이 실패한 뒤(사용자의 페이지 이동이 실패해
                // 페이징이 옛 페이지일 수 있다)에는 문서 전체를 파싱해 페이징도 맞춘다.
                const partial = !force && failures === 0 && !queryString("s_keyword") && table !== -1 && listHtml;
                const dom = new DOMParser().parseFromString(partial ? `<table class="gall_list">${listHtml}` : response, "text/html");

                const oldList = document.querySelector<HTMLElement>(LIST_SELECTOR);
                const newList = dom.querySelector<HTMLElement>(LIST_SELECTOR);

                syncPaging(dom);

                // 목록 없는 응답(오류·차단 안내 페이지)도 실패로 쳐서 주기를 늘린다.
                if (!oldList || !newList) return fail();
                failures = 0;

                const newPostList = replaceList(oldList, newList, {
                    navigated: Boolean(customURL),
                    search: queryString("s_keyword") ? document.querySelector<HTMLInputElement>("#sch_q")?.value ?? "" : undefined,
                    searchType: new URL(target).searchParams.get("s_type"),
                    fadeIn: ctx.settings.fadeIn,
                    // 삭제된 글 보존은 미리보기의 archiveArticle 설정을 따른다 (미리보기를 끄면 같이 꺼진다).
                    // 1페이지 전체 목록에서만 한다. 뒤 페이지는 앞 페이지의 글이 지워지거나 새 글이 들어오면 행이 밀려 빠지고,
                    // 개념글·공지·말머리 목록은 개념글에서 내려가거나 말머리를 바꾼 글도 빠지므로 지워진 글이 아니다.
                    keepDeleted: getModuleApi("preview")?.archiveArticle() === true && isWholeFirstPage(target)
                });
                // 복사해 둔다. slice한 문자열은 응답 전체(수백 KB)를 붙잡아 다음 교체까지 남는다.
                lastListHtml = structuredClone(listHtml);
                notifyListReplaced(gallery);

                if (target === scrollAfter) {
                    scrollAfter = null;
                    document.querySelector(isViewPage ? ".view_bottom_btnbox" : ".page_head")?.scrollIntoView({behavior: smoothScroll(), block: "start"});
                }

                // 페이지를 넘긴 목록은 옛 목록과 겹치는 행이 없으면 전부 새 글로 잡히므로 알리지 않는다 (글댓비 조회가 몰린다).
                if (!customURL && newPostList.length > 0) {
                    getModuleApi("userinfo")?.checkNewPosts(newPostList);
                    unseen.count(newPostList);
                }

                return true;
            } catch (e) {
                // 주소가 바뀌어 끊은 요청은 실패가 아니다. 파이어폭스에선 오류 종류로 가리기 어려워 신호로 본다.
                if (controller.signal.aborted) return false;
                // 임시 차단은 HTTP 클라이언트가 이미 알렸다. 주기만 늘린다.
                if (e instanceof BlockedError) {
                    failures++;
                    return false;
                }
                console.error("Refresh failed:", e);
                return fail();
            } finally {
                loading = false;
                inflight = null;
                // 넘긴 페이지의 로드가 실패했거나 건너뛰었으면 스크롤 예약을 버린다. 남기면 한참 뒤 자동 새로고침이 목록 위로 끌어올린다.
                if (target === scrollAfter) scrollAfter = null;
                if (!ctx.signal.aborted && (target !== originalLocation || rerun)) {
                    rerun = false;
                    // 주소가 바뀐 것은 사용자의 이동이라 그 주소를 넘겨 체크박스 가드를 건너뛴다.
                    void load(target !== originalLocation ? originalLocation : undefined, true);
                }
            }
        };

        // ===== 스케줄링: 주기+지터 재귀 =====
        // 첫 요청도 한 주기 뒤에 보낸다. 파싱 중인 목록을 곧바로 다시 받지 않는다.
        const armNext = (): void => {
            window.clearTimeout(timer);
            // 숨은 탭에선 쉬고(숨은 탭 새로고침을 켜면 그 주기로 받는다), 다시 보이면 onVisibilityChange가 잇는다.
            // 응답을 기다리던 중 숨겨져도 여기서 멈춘다. 모듈을 끈 뒤 응답이 와도 타이머를 다시 걸지 않는다.
            if (ctx.signal.aborted || (document.hidden && !ctx.settings.backgroundRefresh)) return;

            const rate = document.hidden ? ctx.settings.backgroundRefreshRate : ctx.settings.refreshRate;
            const interval = Math.min(rate * 2 ** failures, Math.max(rate, MAXIMUM_BACKOFF_INTERVAL));
            // 응답을 받은 뒤 다음 주기를 잡아야 방금 실패가 바로 반영된다.
            timer = window.setTimeout(() => void load().finally(armNext), interval + 500 + Math.random() * 1500);
        };

        armNext();

        ctx.onSettingsChanged((keys) => {
            if (keys.has("doNotColorVisited")) applyDoNotColorVisited(ctx);
            if (keys.has("titleCount") && !ctx.settings.titleCount) unseen.clear();
            // 주기 설정은 옵션 탭에서 바꾸므로 이미 잡힌 주기가 끝나기를 기다리지 않고 새 값으로 다시 잡는다.
            if (keys.has("refreshRate") || keys.has("backgroundRefresh") || keys.has("backgroundRefreshRate")) armNext();
            if (keys.has("noRefreshOnSearch") && queryString("s_keyword")) setPaused(ctx.settings.noRefreshOnSearch);
        });

        const onVisibilityChange = (): void => {
            if (document.hidden) {
                armNext();
                return;
            }

            // 실패로 주기가 늘어난 동안은 바로 받지 않는다. 탭을 오갈 때마다 요청하면 늘린 주기가 소용없다.
            if (failures === 0) void load();
            armNext();
        };

        // 뒤로/앞으로 가기: 인페이지 전환으로 쌓인 주소의 목록으로 되돌린다.
        // 미리보기가 쌓은 글 주소 사이의 이동은 같은 목록이라 받지 않는다. 다시 받으면 고르던 체크가 풀리고 일시정지를 무시한다.
        const onPopState = (): void => {
            // 미리보기 기록은 history.state로 가린다. 행 링크는 목록 주소의 기본값 쿼리(sort_type=N, 빈 search_pos 등)를 빼서 listUrl로는 가릴 수 없다.
            // 새로고침 전 문서가 쌓은 항목(doc이 다르다)은 미리보기가 아니라 실제 이동이다.
            if (ownPreviewEntry(history.state)) return;
            if (listUrl(location.href) === listUrl(originalLocation)) return;

            window.clearTimeout(timer);
            void load(location.href, true);
            armNext();
        };

        const {signal} = ctx;
        document.addEventListener("visibilitychange", onVisibilityChange, {signal});
        window.addEventListener("popstate", onPopState, {signal});

        ctx.addCleanup(() => window.clearTimeout(timer));
        // 모듈을 끄면 받는 중인 목록도 버린다. 응답이 와서 목록을 갈아끼우지 않게 한다.
        ctx.addCleanup(() => inflight?.abort());

        // ===== 페이지 이동 시 목록만 교체 =====
        // 문서에 리스너 하나만 위임한다. 앵커마다 붙이며 표시 속성을 남기면 페이징 박스 비교가 늘 어긋나 매번 갈아끼운다.
        const onPagingClick = (ev: MouseEvent): void => {
            // 수정키 클릭은 새 탭/창으로 열려는 것이라 가로채지 않는다.
            if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
            if (!ctx.settings.useBetterBrowse) return;

            const anchor = ev.target instanceof Element ? ev.target.closest<HTMLAnchorElement>(`${PAGING_SELECTOR} a`) : null;
            if (!anchor || anchor.getAttribute("href")?.startsWith("javascript:")) return;

            ev.preventDefault();

            const newUrl = new URL(isViewPage ? mergeParamURL(location.href, anchor.href) : anchor.href, location.href).href;
            // 지금 페이지를 다시 누르면 기록을 쌓지 않는다.
            if (newUrl !== location.href) history.pushState(null, document.title, newUrl);

            scrollAfter = newUrl;
            void load(newUrl, true);
        };

        document.addEventListener("click", onPagingClick, {signal});

        const api: RefreshApi = {
            refreshLists: async () => {
                if (Date.now() - lastRefresh < MINIMUM_REFRESH_INTERVAL) {
                    useUiStore.getState().showToast("잠시 후 다시 새로고침해 주세요.");
                    return;
                }

                // 명시적인 요청이라 일시정지(검색 중 기본값 포함)여도 받는다.
                await load(undefined, true);
            },

            togglePause: () => {
                setPaused(!paused);

                useUiStore.getState().showToast(paused ? "이 페이지의 자동 새로고침을 멈췄습니다." : "이 페이지의 자동 새로고침을 다시 켰습니다.");
            },

            isPaused: () => paused,

            reload: async () => {
                window.clearTimeout(timer);
                await load(undefined, true);
                armNext();
            }
        };

        return api;
    },

    shortcuts: {
        refreshLists: (_ctx, api) => void api.refreshLists(),
        refreshPause: (_ctx, api) => api.togglePause()
    },

    pageToggles: [{
        ...PAUSE_TOGGLE,
        desc: "이 페이지의 자동 새로고침을 멈춥니다",
        isOn: (api) => api.isPaused(),
        toggle: (api) => api.togglePause()
    }],

    revoke() {
        document.documentElement.classList.remove("refresherDoNotColorVisited");
        setTitleCount(0);
    }
});
