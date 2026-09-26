import {Search} from "lucide-react";

import {http} from "@/core/http/client";
import {queryString} from "@/core/http/urls";
import {sendMessage} from "@/core/messaging/protocol";
import {defineModule} from "@/core/module/define";
import {LIST_PAGE} from "@/core/pages";
import {checkboxCellFactory, highlightSearchResults, LIST_SELECTOR, PAGING_SELECTOR} from "@/features/refresh";
import {useUiStore} from "@/stores/ui";

/** 검색 결과 행 — 글(data-no)과 그 아래 댓글 검색 행(data-cmt). 설문·AD 행은 뺀다.
 * 검색 구간은 글(댓글) 번호로 나뉘어 겹치지 않는다 — 댓글 검색은 댓글마다 글 행이 되풀이되는 게 정상이라 중복을 거르지 않는다 */
const RESULT_ROW = ":scope > tr:is([data-no], [data-cmt])";

/** 이 검색 구간(search_pos)의 마지막 페이지인지 — 현재 페이지 뒤에 페이지 링크가 없다 */
const isLastPage = (paging: Element): boolean => {
    const next = paging.querySelector("em")?.nextElementSibling;
    return !next || next.classList.contains("search_next");
};

export default defineModule({
    id: "search",
    name: "검색 이어 보기",
    description: "검색 결과가 한 페이지에 못 미치면 다음 검색 결과를 이어 붙입니다.",
    icon: Search,
    urls: [LIST_PAGE],

    settings: {
        maxSearches: {
            type: "range",
            name: "최대 다음 검색",
            desc: "한 번에 이어서 검색할 최대 횟수입니다. 디시는 한 번에 글 1만 개씩 검색합니다.",
            default: 10,
            min: 1,
            max: 30,
            step: 1,
            unit: "회"
        }
    },

    setup(ctx) {
        if (!queryString("s_keyword")) return;

        const gallery = queryString("id") ?? "";
        // 새로고침 모듈이 목록을 갈아끼우면 다시 이어 붙인다 — 이미 받은 검색은 다시 보내지 않는다
        const pages = new Map<string, string>();
        // 행을 붙이면 필터가 같은 tbody에 다시 불린다
        const filled = new WeakSet<HTMLElement>();
        let running: AbortController | null = null;

        const fill = async (list: HTMLElement): Promise<void> => {
            if (filled.has(list)) return;
            filled.add(list);

            running?.abort();
            const controller = new AbortController();
            running = controller;
            const signal = AbortSignal.any([ctx.signal, controller.signal]);

            // 구간 중간 페이지에서 이어 붙이면 그 뒤 페이지를 건너뛴다
            const paging = document.querySelector<HTMLElement>(PAGING_SELECTOR);
            if (!paging || !isLastPage(paging)) return;

            const target = Number(document.querySelector<HTMLInputElement>("#list_num")?.value) || 50;
            let count = list.querySelectorAll(":scope > tr[data-no]").length;
            if (count >= target) return;

            const keyword = document.querySelector<HTMLInputElement>("#sch_q")?.value ?? "";
            const commentSearch = queryString("s_type") === "search_comment";
            // 관리자 목록은 체크박스 열이 있는데 받아온 행엔 없다 (새로고침 모듈과 같은 처리)
            const checkboxCell = list.closest("table")?.querySelector("thead .chkbox_th")
                ? checkboxCellFactory(Array.from(list.querySelectorAll<HTMLTableRowElement>(":scope > tr")))
                : null;

            const max = Number(ctx.settings.maxSearches);
            const status = document.createElement("p");
            status.className = "refresherSearchStatus";
            paging.after(status);
            let added = 0;

            try {
                for (let step = 1; step <= max && count < target; step++) {
                    const next = paging.querySelector<HTMLAnchorElement>("a.search_next");
                    if (!next) break;

                    status.textContent = `다음 검색 중… (${step}/${max})`;
                    let html = pages.get(next.href);
                    if (html === undefined) {
                        html = await http.get(next.href, {signal}).text();
                        pages.set(next.href, html);
                    }

                    const dom = new DOMParser().parseFromString(html, "text/html");
                    const newList = dom.querySelector<HTMLElement>(LIST_SELECTOR);
                    const newPaging = dom.querySelector<HTMLElement>(PAGING_SELECTOR);
                    if (!newList || !newPaging) throw new Error("검색 결과 페이지에 목록이 없습니다.");

                    highlightSearchResults(newList, keyword);
                    for (const row of newList.querySelectorAll<HTMLTableRowElement>(RESULT_ROW)) {
                        // 댓글 검색 결과에선 댓글 행에만 체크박스가 있다
                        if (checkboxCell && !row.querySelector(".article_chkbox") && (!commentSearch || row.classList.contains("search_comment"))) {
                            row.prepend(checkboxCell(row.dataset.no));
                        }
                        list.append(row);
                        if (row.dataset.no) count++;
                        added++;
                    }

                    // 페이징은 마지막으로 받은 구간 것 — 다음 검색·페이지 링크가 거기서 이어진다
                    paging.innerHTML = newPaging.innerHTML;
                    if (!isLastPage(paging)) break;
                }
            } catch (e) {
                if (signal.aborted) return;
                console.error("Search continuation failed:", e);
                useUiStore.getState().showToast("다음 검색 결과를 불러오지 못했습니다.", "error");
            } finally {
                status.remove();
                // 디시 자체 차단·이용자 메모 배지를 붙인 행에도 건다
                if (added > 0) void sendMessage("refresher:listReplaced", gallery).catch(() => {});
            }
        };

        // 처음 목록은 페이징까지 읽은 뒤에, 그 뒤로는 새로고침 모듈이 갈아끼운 목록마다
        const fillCurrent = (): void => {
            const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
            if (list) void fill(list);
        };
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fillCurrent, {once: true, signal: ctx.signal});
        } else {
            fillCurrent();
        }
        ctx.addFilter(LIST_SELECTOR, (list) => {
            if (document.readyState !== "loading") void fill(list);
        });
        ctx.addCleanup(() => running?.abort());
    }
});
