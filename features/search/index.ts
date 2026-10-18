import QuickLRU from "quick-lru";

import {http} from "@/core/http/client";
import {documentUrl, pageGallery, queryString} from "@/core/http/urls";
import {checkboxFiller, highlightSearchResults, LIST_SELECTOR, notifyListReplaced, PAGING_SELECTOR} from "@/core/list";
import {sendMessage} from "@/core/messaging/protocol";
import {defineModule} from "@/core/module/define";
import {BLOCKED_PAGE_MESSAGE, LIST_PAGE} from "@/core/pages";
import {reportFailure} from "@/stores/notify";
import {type SelectedUser, useUiStore} from "@/stores/ui";
import {whenDomReady, writeStyle} from "@/utils/dom";
import {isBlockedError} from "@/utils/error";

import meta from "./meta";
import {addWriterTypes, keepWriterFilter, removeWriterTypes, type WriterFilter, writerFilter, writerSearchUrl, writerSelector} from "./writer";

/**
 * 검색 결과 행: 글(data-no)과 그 아래 댓글 검색 행(data-cmt). 설문·AD 행은 뺀다.
 * 검색 구간은 번호로 나뉘어 겹치지 않으므로 중복을 거르지 않는다. 댓글 검색에선 댓글마다 글 행이 되풀이되는 게 정상이다.
 */
const RESULT_ROW = ":scope > tr:is([data-no], [data-cmt])";
/** 이어 붙인 행. 모듈을 끄면 뺀다. */
const ADDED_ROW = "refresherSearchAdded";
/** 작성자 거르기 중에 다른 작성자의 행을 숨기는 스타일. */
const WRITER_STYLE_ID = "refresher-search-writer";

/** 아이디·IP 검색. 아이디는 갤로그에서 닉네임을 읽어 글쓴이 검색으로 찾고, IP는 닉네임을 몰라 목록을 넘기며 거른다. */
const searchWriter = async (filter: WriterFilter): Promise<void> => {
    const {showToast} = useUiStore.getState();
    if (filter.kind === "ip") {
        // 디시는 유동 IP를 앞 두 자리만 보인다.
        if (!/^\d{1,3}\.\d{1,3}$/.test(filter.value)) return showToast("IP는 123.45처럼 앞 두 자리를 입력해 주세요.", "warning");
        location.href = writerSearchUrl(filter);
        return;
    }
    if (!/^[\w.-]+$/.test(filter.value)) return showToast("아이디를 입력해 주세요.", "warning");
    try {
        const html = await sendMessage("refresher:gallogPage", filter.value);
        // 없는 아이디면 갤로그가 404를 줘 null이 온다.
        const nick = html === null ? undefined : new DOMParser().parseFromString(html, "text/html").querySelector(".nick_name")?.textContent?.trim();
        if (!nick) return showToast("갤로그에서 그 아이디를 찾지 못했습니다.", "warning");
        location.href = writerSearchUrl(filter, nick);
    } catch (e) {
        // 임시 차단은 배경이 받아 이 탭엔 아직 알림이 없다.
        if (isBlockedError(e)) return showToast(BLOCKED_PAGE_MESSAGE, "warning");
        console.error("Gallog lookup failed:", e);
        showToast("갤로그를 불러오지 못했습니다.", "error");
    }
};

/**
 * 유저 버블의 검색. by가 "nick"이면 닉네임으로만 찾고(디시 글쓴이 검색), "identity"면 닉네임으로 찾은 글을 아이디(반고닉·고닉)나 IP(유동)로 거른다.
 * 닉네임이 없으면 목록을 넘기며 거른다.
 */
const searchUserPosts = (user: SelectedUser, by: "nick" | "identity"): void => {
    if (by === "nick") {
        if (user.nick) location.href = writerSearchUrl(null, user.nick);
        return;
    }
    const filter: WriterFilter | null = user.uid ? {kind: "uid", value: user.uid} : user.ip ? {kind: "ip", value: user.ip} : null;
    if (filter) location.href = writerSearchUrl(filter, user.nick);
};

/** 이 검색 구간(search_pos)의 마지막 페이지인지. 현재 페이지(em) 뒤에 페이지 링크가 없으면 마지막이다. */
const isLastPage = (paging: Element): boolean => {
    const next = paging.querySelector("em")?.nextElementSibling;
    return !next || next.classList.contains("search_next");
};

export default defineModule({
    ...meta,

    setup(ctx) {
        const api = {searchUserPosts};
        const filter = writerFilter();
        whenDomReady(() => addWriterTypes(filter, (next) => void searchWriter(next), ctx.signal), ctx.signal);
        if (filter) writeStyle(WRITER_STYLE_ID, `${LIST_SELECTOR} > tr:not(:has(${writerSelector(filter)})) { display: none !important; }`);

        // 이어 붙이기는 목록 페이지의 검색 결과나 작성자 거르기에서만. 거르기만 있으면 검색이 아니라 목록 다음 쪽을 잇는다.
        const searching = Boolean(queryString("s_keyword"));
        if (!LIST_PAGE.test(documentUrl.pathname) || (!searching && !filter)) return api;
        // 거르면 이 작성자의 글만 센다. 다른 작성자의 행은 숨겨 있으니 그만큼 더 이어야 쪽이 찬다.
        const counted = (row: HTMLElement): boolean => Boolean(row.dataset.no) && (!filter || row.querySelector(writerSelector(filter)) !== null);

        const gallery = pageGallery ?? "";
        // 받은 검색 페이지(칠한 결과 행과 페이징 HTML). 새로고침 모듈이 목록을 갈아끼워 다시 이을 때 요청·파싱을 건너뛴다.
        // 다시 이을 때 같은 다음 검색을 처음부터 따라가므로 최대 다음 검색 횟수만큼 둔다. 더 작으면 따라가는 동안 앞 페이지가 밀려나 하나도 맞지 않는다.
        const pages = new QuickLRU<string, { rows: HTMLTableRowElement[]; paging: string }>({maxSize: ctx.settings.maxSearches});
        ctx.onSettingsChanged(() => pages.resize(ctx.settings.maxSearches));
        // 행을 붙이면 같은 tbody로 필터가 다시 불리므로 한 번만 채운다.
        const filled = new WeakSet<HTMLElement>();
        let running: AbortController | null = null;

        const fill = async (list: HTMLElement): Promise<void> => {
            if (filled.has(list)) return;
            filled.add(list);
            // 파이어폭스 재주입 전 인스턴스가 이미 이어 붙인 목록이다. 페이징도 그쪽이 바꾼 것이라 원본으로 저장할 수 없고,
            // 더 이으면 최대 다음 검색 횟수를 넘는다.
            if (list.querySelector(`.${ADDED_ROW}`)) return;

            running?.abort();
            const controller = new AbortController();
            running = controller;
            const signal = AbortSignal.any([ctx.signal, controller.signal]);

            // 구간의 마지막 페이지에서만 잇는다. 중간 페이지에서 이으면 그 뒤 페이지를 건너뛴다.
            const paging = document.querySelector<HTMLElement>(PAGING_SELECTOR);
            if (!paging) return;
            // 모듈을 끄면 되돌릴 이 목록의 페이징. 앞 목록에서 둔 것은 새로고침 모듈이 페이징을 맞추면서 낡았으니 덮는다.
            paging.dataset.refresherSearchPaging = paging.innerHTML;
            if (filter) keepWriterFilter(paging, filter);
            if (searching && !isLastPage(paging)) return;

            const target = Number(document.querySelector<HTMLInputElement>("#list_num")?.value) || 50;
            let count = Array.from(list.querySelectorAll<HTMLElement>(":scope > tr"), counted).filter(Boolean).length;
            if (count >= target) return;

            const keyword = document.querySelector<HTMLInputElement>("#sch_q")?.value ?? "";
            const commentSearch = queryString("s_type") === "search_comment";
            const fillCheckbox = checkboxFiller(list, commentSearch);

            const max = ctx.settings.maxSearches;
            // 화면 낭독기가 진행을 읽게 상태 영역으로 알린다.
            const status = Object.assign(document.createElement("p"), {className: "refresherSearchStatus"});
            status.setAttribute("role", "status");
            paging.after(status);
            let added = 0;

            try {
                for (let step = 1; step <= max && count < target; step++) {
                    // 검색은 다음 검색 구간, 거르기만 하는 목록은 다음 쪽이다.
                    const next = paging.querySelector<HTMLAnchorElement>(searching ? "a.search_next" : "em + a");
                    if (!next) break;

                    status.textContent = `${searching ? "다음 검색" : "다음 쪽 확인"} 중… (${step}/${max})`;
                    let page = pages.get(next.href);
                    if (!page) {
                        const dom = new DOMParser().parseFromString(await http.get(next.href, {signal}).text(), "text/html");
                        const newList = dom.querySelector<HTMLElement>(LIST_SELECTOR);
                        const newPaging = dom.querySelector<HTMLElement>(PAGING_SELECTOR);
                        // 알림 페이지 같은 것은 캐시에 두지 않는다. 두면 다시 채울 때마다 같은 오류가 난다.
                        if (!newList || !newPaging) throw new Error("검색 결과 페이지에 목록이 없습니다.");

                        highlightSearchResults(newList, keyword, commentSearch);
                        // 행은 이 문서로 옮겨 담는다. 받은 문서의 노드를 잡고 있으면 그 문서 전체가 남는다.
                        const rows = Array.from(newList.querySelectorAll<HTMLTableRowElement>(RESULT_ROW), (row) => document.adoptNode(row));
                        page = {rows, paging: newPaging.innerHTML};
                        pages.set(next.href, page);
                    }

                    // 붙이면 노드가 옮겨 가므로 복제해 붙인다. 캐시의 행은 다른 모듈이 고치지 않은 채로 다시 이을 때 쓴다.
                    for (const cached of page.rows) {
                        // 목록 쪽은 그새 새 글이 올라와 앞 쪽의 행이 다음 쪽에 다시 온다.
                        if (!searching && cached.dataset.no && list.querySelector(`:scope > tr[data-no="${cached.dataset.no}"]`)) continue;
                        const row = document.importNode(cached, true);
                        row.classList.add(ADDED_ROW);
                        fillCheckbox(row);
                        list.append(row);
                        if (counted(row)) count++;
                        added++;
                    }

                    // 페이징은 마지막으로 받은 구간 것으로 바꾼다. 다음 검색·페이지 링크가 거기서 이어진다.
                    paging.innerHTML = page.paging;
                    if (filter) keepWriterFilter(paging, filter);
                    if (searching && !isLastPage(paging)) break;
                }
            } catch (e) {
                if (!signal.aborted) reportFailure(e, "Search continuation failed:", "다음 검색 결과를 불러오지 못했습니다.");
            } finally {
                status.remove();
                if (added > 0) notifyListReplaced(gallery);
            }
        };

        // 처음 목록은 페이징까지 읽은 뒤에, 그 뒤로는 새로고침 모듈이 갈아끼운 목록마다.
        whenDomReady(() => ctx.addFilter(LIST_SELECTOR, (list) => void fill(list)), ctx.signal);
        return api;
    },

    revoke() {
        document.querySelector(`style#${WRITER_STYLE_ID}`)?.remove();
        removeWriterTypes();
        // 모듈을 끄면 목록을 다시 받는 쪽이 없어 이어 붙인 다른 구간 행과 페이징이 새로고침할 때까지 남는다.
        for (const row of document.querySelectorAll(`.${ADDED_ROW}`)) row.remove();
        const paging = document.querySelector<HTMLElement>(PAGING_SELECTOR);
        const original = paging?.dataset.refresherSearchPaging;
        if (!paging || original === undefined) return;
        paging.innerHTML = original;
        delete paging.dataset.refresherSearchPaging;
    }
});
