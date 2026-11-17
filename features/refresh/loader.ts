import {http} from "@/core/http/client";
import {isViewPage, listUrl, queryString, writerFilter} from "@/core/http/urls";
import {LIST_SELECTOR, notifyListReplaced, writerSelector} from "@/core/list";
import {getModuleApi} from "@/core/module/registry";
import {useUiStore} from "@/stores/ui";
import {smoothScroll} from "@/utils/dom";
import {sha256} from "@/utils/hash";

import {isWholeFirstPage, replaceList, syncPaging} from "./list";
import {LIST_TABLE} from "./markup";
import {type Ctx} from "./meta";
import {createUnseenCounter} from "./title";

/** 목록 요청 하나의 제한 (머리 제한 15초 + 본문 수신 시간). */
const LIST_TIMEOUT = 30_000;
/** 같은 요청을 다시 보내지 않는 최소 간격. */
export const MINIMUM_REFRESH_INTERVAL = 2000;

/** 스케줄러(index.ts)와 로더가 함께 읽고 쓰는 상태. */
export interface RefreshState {
    paused: boolean;
    lastRefresh: number;
    /** 새 글 없이 끝난 자동 새로고침 수. 주기를 배수까지 늘리고 사용자 활동이 0으로 되돌린다. */
    quiet: number;
    /** 페이지를 넘긴 주소. 그 목록으로 갈아끼운 직후 목록 위로 스크롤한다. */
    scrollAfter: string | null;
    /** 글 보기 페이지에서 목록이 화면 밖인지. */
    offscreen: boolean;
    /** 목록이 화면 밖이라 건너뛴 자동 새로고침이 있는지. 다시 보이면 곧바로 받는다. */
    missed: boolean;
}

type UnseenCounter = ReturnType<typeof createUnseenCounter>;

export const createListLoader = (ctx: Ctx, state: RefreshState, unseen: UnseenCounter, gallery: string) => {
    let originalLocation = location.href;
    let loading = false;
    let timerRerun = false;
    /** 연달아 실패한 목록 요청 수. 실패할 때마다 자동 새로고침 주기가 두 배가 된다. */
    let failures = 0;
    /** 진행 중인 목록 요청. 주소가 바뀌면 끊는다. */
    let inflight: AbortController | null = null;
    /** 지난번 목록 tbody의 SHA-256. 같으면 파싱·교체를 건너뛴다 (HTML을 들고 있으면 탭마다 150KB를 붙잡는다). */
    let lastListHash = "";

    // 목록을 갈아끼우면 안 되는 때. 응답을 기다리는 동안 생길 수 있어 응답을 받은 뒤에도 본다.
    const holdList = (customURL?: string, force?: boolean): boolean => {
        // 커서, :focus-visible이 목록 위에 있으면 건너뛴다. 숨은 탭엔 옛 :hover가 남아 보지 않는다.
        if (!force) {
            const list = ctx.settings.pauseOnHover && !document.hidden ? document.querySelector(LIST_SELECTOR) : null;
            if (list && (list.matches(":hover") || list.querySelector(":focus-visible"))) return true;
        }

        // 목록 표 안의 체크박스, 유저 메뉴가 열려 있으면 갈아끼우지 않는다.
        const held = !customURL && document.querySelector(".gall_list:not([id]) :is(.article_chkbox:checked, .user_data.add)") !== null;
        // 강제 로드(Alt+R, 미리보기 관리 동작 뒤)는 다시 시도하지 않아 말없이 버리면 지운 글이 목록에 남은 채 아무 반응이 없다.
        if (held && force) useUiStore.getState().showToast("고른 글이나 열린 유저 메뉴가 있어 글 목록을 새로고침하지 않았습니다.", "warning");
        return held;
    };

    const load = async (customURL?: string, force?: boolean): Promise<boolean> => {
        // 먼저 바꿔 다음 새로고침부터 새 주소를 받게 한다. 진행 중인 응답은 지난 주소라 끊는다.
        if (customURL && customURL !== originalLocation) {
            originalLocation = customURL;
            inflight?.abort();
        }

        // 모듈을 끈 뒤 남은 타이머, 재시도가 부른 것. 겹치는 요청은 자동은 버리고 강제는 끝난 뒤 다시 받는다.
        if (loading && force) timerRerun = true;
        if (ctx.signal.aborted || loading) return false;
        // 강제 로드는 숨은 탭에서도 받고, 일시정지·최소 간격을 넘긴다. 미룬 것(rerun)을 버리면 옛 목록이 그대로 남는다.
        if (!force && (document.hidden && !ctx.settings.backgroundRefresh
            || Date.now() - state.lastRefresh < MINIMUM_REFRESH_INTERVAL || state.paused)) return false;
        // 새 글은 1페이지에만 들어온다. 뒤 페이지는 갈아끼워 봐야 행이 밀려 읽던 글이 다음 페이지로 사라질 뿐이다.
        if (!force) {
            const page = new URL(originalLocation).searchParams.get("page");
            if (page && page !== "1") return false;

            // 미리보기 창이 목록을 덮고 있는 동안 받아 봐야 볼 사람이 없다. 창을 닫으면 catchUp이 곧바로 받는다.
            if (state.offscreen || getModuleApi("preview")?.isOpen()) {
                state.missed = true;
                return false;
            }
        }

        if (holdList(customURL, force)) return false;

        loading = true;
        // 기다리는 동안 뒤로 가기, 페이지 이동으로 originalLocation이 바뀔 수 있어 요청한 주소를 고정한다.
        const target = originalLocation;
        const controller = new AbortController();
        inflight = controller;

        const fail = (): false => {
            failures++;
            // 사용자가 한 이동, 새로고침이 실패하면 주소만 바뀌고 목록은 그대로라 알린다.
            if (force) useUiStore.getState().showToast("글 목록을 불러오지 못했습니다.", "error");
            return false;
        };

        try {
            state.lastRefresh = Date.now();

            // ky 재시도는 Retry-After를 기다려 요청이 묶이므로 자동 새로고침은 retry 없이 armNext가 주기를 늘린다.
            const response = await http.get(listUrl(target), {
                signal: controller.signal,
                totalTimeout: LIST_TIMEOUT,
                ...(force ? {} : {retry: 0})
            }).text();

            // 목록이 그대로면 파싱, 교체를 건너뛴다. 응답 전체는 요청마다 바뀌는 값(s_key)이 있어 목록 표의 tbody만 비교한다.
            const table = response.indexOf(LIST_TABLE);
            // 표를 못 찾으면 -1로 둔다. indexOf(..., -1)은 처음부터 찾아 다른 tbody를 목록으로 잡는다.
            const start = table === -1 ? -1 : response.indexOf("<tbody", table);
            const end = start === -1 ? -1 : response.indexOf("</tbody>", start);
            // 표가 없거나 잘린 응답(</tbody> 없음)은 문서 전체를 파싱한다.
            const listHtml = end === -1 ? "" : response.slice(start, end);
            const listHash = listHtml && await sha256(new TextEncoder().encode(listHtml));
            // 그사이 주소가 바뀌었거나 모듈을 껐으면 지난 주소의 목록이라 버린다.
            if (target !== originalLocation || ctx.signal.aborted) return false;
            if (!customURL && listHash && listHash === lastListHash) {
                failures = 0;
                state.quiet = force ? 0 : state.quiet + 1;
                unseen.count([]);
                return true;
            }
            // 응답을 기다리는 동안 커서를 올리거나 체크했으면 버린다. lastListHash를 아직 바꾸지 않아야 다음 주기에 이 목록이 들어간다.
            if (holdList(customURL, force)) return false;

            // 자동 새로고침은 목록 표만 파싱하고, 검색·거르기·이동·실패 뒤엔 문서 전체를 파싱해 페이징도 맞춘다.
            const filter = writerFilter(target);
            const writer = filter !== null;
            const partial = !force && failures === 0 && !queryString("s_keyword") && !writer && listHtml;
            const dom = new DOMParser().parseFromString(partial ? `<table class="gall_list">${listHtml}` : response, "text/html");

            const oldList = document.querySelector<HTMLElement>(LIST_SELECTOR);
            const newList = dom.querySelector<HTMLElement>(LIST_SELECTOR);

            syncPaging(dom);

            // 목록 없는 응답(오류, 차단 안내 페이지)도 실패로 쳐서 주기를 늘린다.
            if (!oldList || !newList) return fail();
            failures = 0;

            const {added: newPostList, changed} = replaceList(oldList, newList, {
                navigated: Boolean(customURL),
                // 작성자 거르기도 검색처럼 통째로 바꾼다. 제자리에서 고치면 검색 모듈이 이어 붙인 행이 어긋난다.
                search: queryString("s_keyword") ? document.querySelector<HTMLInputElement>("#sch_q")?.value ?? "" : writer ? "" : undefined,
                searchType: new URL(target).searchParams.get("s_type"),
                fadeIn: ctx.settings.fadeIn,
                // 삭제된 글 보존은 미리보기 archiveArticle 설정을 따르고, 빠진 글이 지워진 글인 목록에서만 한다.
                keepDeleted: getModuleApi("preview")?.archiveArticle() === true && isWholeFirstPage(target)
            });
            lastListHash = listHash;
            // 수만 고쳤으면 차단, 메모 표시를 다시 걸 행이 없으니 알리지 않는다. 알리면 주기마다 배경 왕복, 페이지 주입이 생긴다.
            if (changed) {
                notifyListReplaced(gallery);
                unseen.showMark();
            }

            if (target === state.scrollAfter) {
                state.scrollAfter = null;
                document.querySelector(isViewPage ? ".view_bottom_btnbox" : ".page_head")?.scrollIntoView({behavior: smoothScroll(), block: "start"});
            }

            state.quiet = force || newPostList.length > 0 ? 0 : state.quiet + 1;

            // 페이지를 넘긴 목록은 모두 새 글로 잡히므로 알리지 않고, 거르기 중에는 이 작성자의 행만 조회한다.
            const checked = filter ? newPostList.filter((row) => row.querySelector(writerSelector(filter))) : newPostList;
            if (!customURL && checked.length > 0) getModuleApi("userinfo")?.checkNewPosts(checked);
            unseen.count(customURL ? [] : newPostList);

            return true;
        } catch (e) {
            // 주소가 바뀌어 끊은 요청은 실패가 아니다. 파이어폭스에선 오류 종류로 가리기 어려워 신호로 본다.
            if (controller.signal.aborted) return false;
            console.error("Refresh failed:", e);
            return fail();
        } finally {
            loading = false;
            inflight = null;
            // 넘긴 페이지의 로드가 실패했거나 건너뛰었으면 스크롤 예약을 버린다. 남기면 한참 뒤 자동 새로고침이 목록 위로 끌어올린다.
            if (target === state.scrollAfter) state.scrollAfter = null;
            if (!ctx.signal.aborted && (target !== originalLocation || timerRerun)) {
                timerRerun = false;
                // 주소가 바뀐 것은 사용자의 이동이라 그 주소를 넘겨 체크박스 가드를 건너뛴다.
                void load(target !== originalLocation ? originalLocation : undefined, true);
            }
        }
    };

    return {load, failures: (): number => failures, currentUrl: (): string => originalLocation, abort: (): void => inflight?.abort()};
};
