import {isViewPage, listUrl, mergeParamURL, pageGallery, queryString, writerFilter} from "@/core/http/urls";
import {LIST_SELECTOR, PAGING_SELECTOR} from "@/core/list";
import {defineModule} from "@/core/module/define";
import {ownPreviewEntry} from "@/core/preview/history";
import {useUiStore} from "@/stores/ui";
import {whenDomReady} from "@/utils/dom";
import {hasModifier, isTyping} from "@/utils/event";

import {clearNewPost} from "./list";
import {createListLoader, MINIMUM_REFRESH_INTERVAL, type RefreshState} from "./loader";
import meta, {type Ctx} from "./meta";
import {createUnseenCounter} from "./title";

/** 새 글 없는 자동 새로고침이 이어질 때 늘리는 주기의 상한 (배수). */
const MAXIMUM_QUIET_FACTOR = 4;
const MAXIMUM_BACKOFF_INTERVAL = 60_000;

interface RefreshApi {
    refreshLists(): Promise<void>;

    togglePause(): void;

    isPaused(): boolean;

    reload(): Promise<void>;

    catchUp(): void;
}

const applyDoNotColorVisited = (ctx: Ctx): void => {
    document.documentElement.classList.toggle("refresherDoNotColorVisited", ctx.settings.doNotColorVisited);
};

export default defineModule(meta, {
    setup(ctx) {
        ctx.onRevoke(() => {
            // 탭 제목의 새 글 수와 '여기까지 읽음' 선은 title.ts의 정리 함수(clearTitle, clearMark)가 뗀다.
            document.documentElement.classList.remove("refresherDoNotColorVisited");
            // 남긴 삭제된 글 행은 서버 목록에 없다. 모듈을 끄면 목록을 다시 받는 쪽이 없어 페이지를 새로고침할 때까지 남는다.
            for (const row of document.querySelectorAll(".refresherDeleted")) row.remove();
            for (const row of document.querySelectorAll<HTMLElement>(".refresherNewPost")) clearNewPost(row);
        });

        // 아이디, IP 검색(작성자 거르기)도 검색이다. 다시 이을 때마다 다음 쪽들을 새로 받으므로(features/search) 주기마다 돌면 요청이 몰린다.
        const searching = (): boolean => Boolean(queryString("s_keyword") || writerFilter());
        const unseen = createUnseenCounter(ctx);
        const gallery = pageGallery ?? "";
        // 스케줄러와 로더가 함께 읽고 쓰는 상태 (loader.ts).
        const state: RefreshState = {
            paused: searching() && ctx.settings.noRefreshOnSearch,
            lastRefresh: 0,
            quiet: 0,
            scrollAfter: null,
            offscreen: false,
            missed: false
        };
        const {load, failures, currentUrl, abort} = createListLoader(ctx, state, unseen, gallery);
        let timer = 0;

        let button: HTMLButtonElement | null = null;
        const label = (): string => (state.paused ? "자동 새로고침: 꺼짐" : "자동 새로고침: 켜짐");
        const setPaused = (next: boolean): void => {
            state.paused = next;
            if (button) button.textContent = label();
        };

        // 문서를 다 읽은 뒤 넣는다. 읽는 중엔 파서가 필터를 다시 불러 목록 페이지가 늦게 열린다.
        whenDomReady(() => ctx.addFilter(
            ".page_head > .gall_issuebox",
            (element) => {
                // 이 실행의 버튼이면 둔다. 재주입 전 인스턴스가 남긴 버튼은 죽어 있어 갈아끼운다.
                if (button && element.contains(button)) return;
                element.querySelector("button[data-refresher-refresh]")?.remove();

                button = Object.assign(document.createElement("button"), {type: "button", textContent: label()});
                button.dataset.refresherRefresh = "true";
                button.addEventListener("click", () => setPaused(!state.paused));
                element.append(button);
            }
        ), ctx.signal);
        // 문서에 넣은 DOM은 onRevoke로 뗀다. addCleanup은 stopAll(확장 업데이트)에서도 도는데 그때는 페이지를 그대로 둬야 한다.
        ctx.onRevoke(() => button?.remove());

        applyDoNotColorVisited(ctx);

        // ===== 스케줄링: 주기+지터 재귀 =====
        // 첫 요청도 한 주기 뒤에 보낸다. 파싱 중인 목록을 곧바로 다시 받지 않는다.
        const armNext = (): void => {
            window.clearTimeout(timer);
            // 모듈을 껐거나 숨은 탭이면(숨은 탭 새로고침이 꺼져 있을 때) 멈춘다. 다시 보이면 onVisibilityChange가 잇는다.
            if (ctx.signal.aborted || (document.hidden && !ctx.settings.backgroundRefresh)) return;

            const rate = document.hidden ? ctx.settings.backgroundRefreshRate : ctx.settings.refreshRate;
            // 실패로 늘린 주기와 새 글이 없어 늘린 주기 중 긴 쪽을 쓴다.
            const interval = Math.max(
                rate * Math.min(1 + state.quiet / 2, MAXIMUM_QUIET_FACTOR),
                Math.min(rate * 2 ** failures(), Math.max(rate, MAXIMUM_BACKOFF_INTERVAL))
            );
            // 응답을 받은 뒤 다음 주기를 잡아야 방금 실패가 바로 반영된다.
            timer = window.setTimeout(() => void loadNow(), interval + 500 + Math.random() * 1500);
        };

        // 잡힌 주기를 버리고 곧바로 받은 뒤 다음 주기를 잡는다. load는 실패해도 false를 돌려줄 뿐 던지지 않는다.
        const loadNow = (customURL?: string, force?: boolean): Promise<boolean> => {
            window.clearTimeout(timer);
            return load(customURL, force).finally(armNext);
        };

        armNext();

        const catchUp = (): void => {
            if (!state.missed) return;
            state.missed = false;
            void loadNow();
        };

        if (isViewPage) whenDomReady(() => {
            // tbody는 새로고침마다 갈아끼우므로 그대로 남는 표를 지켜본다.
            const table = document.querySelector(LIST_SELECTOR)?.closest("table");
            if (!table) return;
            // 한 번에 여러 변화가 오면 마지막이 지금 상태다.
            const observer = new IntersectionObserver((entries) => {
                state.offscreen = entries.at(-1)?.isIntersecting === false;
                if (!state.offscreen) catchUp();
            });
            observer.observe(table);
            ctx.addCleanup(() => observer.disconnect());
        }, ctx.signal);

        ctx.onSettingsChanged((keys) => {
            if (keys.has("doNotColorVisited")) applyDoNotColorVisited(ctx);
            if (keys.has("titleCount") && !ctx.settings.titleCount) unseen.clearTitle();
            if (keys.has("readMark") && !ctx.settings.readMark) unseen.clearMark();
            // 주기 설정은 옵션 탭에서 바꾸므로 이미 잡힌 주기가 끝나기를 기다리지 않고 새 값으로 다시 잡는다.
            if (keys.has("refreshRate") || keys.has("backgroundRefresh") || keys.has("backgroundRefreshRate")) armNext();
            if (keys.has("noRefreshOnSearch") && searching()) setPaused(ctx.settings.noRefreshOnSearch);
        });

        const onVisibilityChange = (): void => {
            if (document.hidden) {
                armNext();
                return;
            }

            state.quiet = 0;
            // 실패로 주기가 늘어난 동안은 바로 받지 않는다. 탭을 오갈 때마다 요청하면 늘린 주기가 소용없다.
            if (failures() === 0) void loadNow();
            else armNext();
        };

        // 뒤로/앞으로 가기: 쌓인 주소의 목록으로 되돌린다. 미리보기 기록은 같은 목록이라 건너뛴다.
        const onPopState = (): void => {
            // 미리보기 기록은 history.state로 가린다. 행 링크는 목록 주소의 기본값 쿼리(sort_type=N, 빈 search_pos 등)를 빼서 listUrl로는 가릴 수 없다.
            if (ownPreviewEntry(history.state)) return;
            if (listUrl(location.href) === listUrl(currentUrl())) return;

            void loadNow(location.href, true);
        };

        const {signal} = ctx;
        document.addEventListener("visibilitychange", onVisibilityChange, {signal});

        // 목록 위 활동은 늘린 주기를 되돌린다. 댓글 입력은 세지 않는다 (타이핑마다 다시 잡게 된다).
        const onActivity = (ev: Event): void => {
            if (state.quiet === 0 || (ev.type === "pointerover" ? !(ev.target instanceof Element && ev.target.closest(".gall_list")) : isTyping(ev))) return;
            state.quiet = 0;
            armNext();
        };
        document.addEventListener("pointerover", onActivity, {signal, passive: true});
        document.addEventListener("keydown", onActivity, {signal, passive: true});
        window.addEventListener("popstate", onPopState, {signal});

        ctx.addCleanup(() => window.clearTimeout(timer));
        // 모듈을 끄면 받는 중인 목록도 버린다. 응답이 와서 목록을 갈아끼우지 않게 한다.
        ctx.addCleanup(abort);

        // ===== 페이지 이동 시 목록만 교체 =====
        // 문서에 리스너 하나만 위임한다. 앵커마다 붙이며 표시 속성을 남기면 페이징 박스 비교가 늘 어긋나 매번 갈아끼운다.
        const onPagingClick = (ev: MouseEvent): void => {
            // 수정키 클릭은 새 탭/창으로 열려는 것이라 가로채지 않는다.
            if (ev.button !== 0 || hasModifier(ev)) return;
            if (!ctx.settings.useBetterBrowse) return;

            const anchor = ev.target instanceof Element ? ev.target.closest<HTMLAnchorElement>(`${PAGING_SELECTOR} a`) : null;
            if (!anchor || anchor.getAttribute("href")?.startsWith("javascript:")) return;

            ev.preventDefault();

            const newUrl = new URL(isViewPage ? mergeParamURL(location.href, anchor.href) : anchor.href, location.href).href;
            // 지금 페이지를 다시 누르면 기록을 쌓지 않는다. 쌓기가 실패해도 기본 동작을 이미 막았으니 목록은 받는다.
            try {
                if (newUrl !== location.href) history.pushState(null, document.title, newUrl);
            } catch (e) {
                console.error("페이지 이동 기록 쌓기 실패:", e);
            }

            state.scrollAfter = newUrl;
            void loadNow(newUrl, true);
        };

        document.addEventListener("click", onPagingClick, {signal});

        const api: RefreshApi = {
            refreshLists: async () => {
                if (Date.now() - state.lastRefresh < MINIMUM_REFRESH_INTERVAL) {
                    useUiStore.getState().showToast("잠시 후 다시 새로고침해 주세요.");
                    return;
                }

                // 명시적인 요청이라 일시정지(검색 중 기본값 포함)여도 받는다.
                await load(undefined, true);
            },

            togglePause: () => {
                setPaused(!state.paused);

                useUiStore.getState().showToast(state.paused ? "이 페이지의 자동 새로고침을 멈췄습니다." : "이 페이지의 자동 새로고침을 다시 켰습니다.");
            },

            isPaused: () => state.paused,

            reload: async () => {
                await loadNow(undefined, true);
            },

            catchUp
        };

        return api;
    },

    shortcuts: {
        refreshLists: (api) => void api.refreshLists(),
        refreshPause: (api) => api.togglePause()
    },

    pageToggles: {
        pause: {
            desc: "이 페이지의 자동 새로고침을 멈춥니다",
            isOn: (api) => api.isPaused(),
            toggle: (api) => api.togglePause()
        }
    }
});
