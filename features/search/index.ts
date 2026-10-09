import QuickLRU from "quick-lru";

import {BlockedError, http} from "@/core/http/client";
import {queryString} from "@/core/http/urls";
import {checkboxFiller, highlightSearchResults, LIST_SELECTOR, notifyListReplaced, PAGING_SELECTOR} from "@/core/list";
import {defineModule} from "@/core/module/define";
import {useUiStore} from "@/stores/ui";
import {whenDomReady} from "@/utils/dom";

import meta from "./meta";

/**
 * 검색 결과 행: 글(data-no)과 그 아래 댓글 검색 행(data-cmt). 설문·AD 행은 뺀다.
 * 검색 구간은 번호로 나뉘어 겹치지 않으므로 중복을 거르지 않는다. 댓글 검색에선 댓글마다 글 행이 되풀이되는 게 정상이다.
 */
const RESULT_ROW = ":scope > tr:is([data-no], [data-cmt])";

/** 이 검색 구간(search_pos)의 마지막 페이지인지. 현재 페이지(em) 뒤에 페이지 링크가 없으면 마지막이다. */
const isLastPage = (paging: Element): boolean => {
    const next = paging.querySelector("em")?.nextElementSibling;
    return !next || next.classList.contains("search_next");
};

export default defineModule({
    ...meta,

    setup(ctx) {
        if (!queryString("s_keyword")) return;

        const gallery = queryString("id") ?? "";
        // 새로고침 모듈이 목록을 갈아끼우면 다시 이어 붙이는데, 이미 받은 검색 페이지는 다시 요청·파싱하지 않는다. 검색어를 칠한 결과 행과 페이징 HTML만 담는다.
        // 다시 이을 때 같은 다음 검색을 처음부터 따라가므로 최대 다음 검색 횟수만큼 둔다. 더 작으면 따라가는 동안 앞 페이지가 밀려나 하나도 맞지 않는다.
        // quick-lru는 두 세대로 나눠 두어 그 두 배 가까이 남긴다.
        const pages = new QuickLRU<string, { rows: HTMLTableRowElement[]; paging: string }>({maxSize: ctx.settings.maxSearches});
        ctx.onSettingsChanged(() => pages.resize(ctx.settings.maxSearches));
        // 행을 붙이면 같은 tbody로 필터가 다시 불리므로 한 번만 채운다.
        const filled = new WeakSet<HTMLElement>();
        let running: AbortController | null = null;

        const fill = async (list: HTMLElement): Promise<void> => {
            if (filled.has(list)) return;
            filled.add(list);

            running?.abort();
            const controller = new AbortController();
            running = controller;
            const signal = AbortSignal.any([ctx.signal, controller.signal]);

            // 구간의 마지막 페이지에서만 잇는다. 중간 페이지에서 이으면 그 뒤 페이지를 건너뛴다.
            const paging = document.querySelector<HTMLElement>(PAGING_SELECTOR);
            if (!paging || !isLastPage(paging)) return;

            const target = Number(document.querySelector<HTMLInputElement>("#list_num")?.value) || 50;
            let count = list.querySelectorAll(":scope > tr[data-no]").length;
            if (count >= target) return;

            const keyword = document.querySelector<HTMLInputElement>("#sch_q")?.value ?? "";
            const fillCheckbox = checkboxFiller(list, queryString("s_type") === "search_comment");

            const max = ctx.settings.maxSearches;
            const status = Object.assign(document.createElement("p"), {className: "refresherSearchStatus"});
            paging.after(status);
            let added = 0;

            try {
                for (let step = 1; step <= max && count < target; step++) {
                    const next = paging.querySelector<HTMLAnchorElement>("a.search_next");
                    if (!next) break;

                    status.textContent = `다음 검색 중… (${step}/${max})`;
                    let page = pages.get(next.href);
                    if (!page) {
                        const dom = new DOMParser().parseFromString(await http.get(next.href, {signal}).text(), "text/html");
                        const newList = dom.querySelector<HTMLElement>(LIST_SELECTOR);
                        const newPaging = dom.querySelector<HTMLElement>(PAGING_SELECTOR);
                        // 알림 페이지 같은 것은 캐시에 두지 않는다. 두면 다시 채울 때마다 같은 오류가 난다.
                        if (!newList || !newPaging) throw new Error("검색 결과 페이지에 목록이 없습니다.");

                        highlightSearchResults(newList, keyword);
                        // 행은 이 문서로 옮겨 담는다. 받은 문서의 노드를 잡고 있으면 그 문서 전체가 남는다.
                        const rows = Array.from(newList.querySelectorAll<HTMLTableRowElement>(RESULT_ROW), (row) => document.adoptNode(row));
                        page = {rows, paging: newPaging.innerHTML};
                        pages.set(next.href, page);
                    }

                    // 붙이면 노드가 옮겨 가므로 복제해 붙인다. 캐시의 행은 다른 모듈이 고치지 않은 채로 다시 이을 때 쓴다.
                    for (const cached of page.rows) {
                        const row = document.importNode(cached, true);
                        fillCheckbox(row);
                        list.append(row);
                        if (row.dataset.no) count++;
                        added++;
                    }

                    // 페이징은 마지막으로 받은 구간 것으로 바꾼다. 다음 검색·페이지 링크가 거기서 이어진다.
                    paging.innerHTML = page.paging;
                    if (!isLastPage(paging)) break;
                }
            } catch (e) {
                // 임시 차단은 HTTP 클라이언트가 이미 알렸다. 오류 토스트로 그 안내를 덮지 않는다.
                if (signal.aborted || e instanceof BlockedError) return;
                console.error("Search continuation failed:", e);
                useUiStore.getState().showToast("다음 검색 결과를 불러오지 못했습니다.", "error");
            } finally {
                status.remove();
                if (added > 0) notifyListReplaced(gallery);
            }
        };

        // 처음 목록은 페이징까지 읽은 뒤에, 그 뒤로는 새로고침 모듈이 갈아끼운 목록마다.
        const fillCurrent = (): void => {
            const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
            if (list) void fill(list);
        };
        whenDomReady(fillCurrent, ctx.signal);
        ctx.addFilter(LIST_SELECTOR, (list) => {
            if (document.readyState !== "loading") void fill(list);
        });
        ctx.addCleanup(() => running?.abort());
    }
});
