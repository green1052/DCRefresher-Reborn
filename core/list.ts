// 디시 글 목록 DOM 도우미. 목록을 갈아끼우거나 이어 붙이는 refresh·search 모듈과 행을 찾는 모듈이 같이 쓴다.
import {sendMessage} from "@/core/messaging/protocol";

/** 갈아끼울 글 목록 tbody. 검색 페이지 아래쪽 통합검색 목록(#kakao_seach_list)은 id가 있어 :not([id])로 빠진다. */
export const LIST_SELECTOR = ".gall_list:not([id]) tbody";
export const PAGING_SELECTOR = ".left_content article:has(.gall_listwrap) .bottom_paging_box";

/**
 * 작성자 칸(.ub-writer)이 든 행. 글 목록 행·글 보기 머리·댓글은 .ub-content이고,
 * 댓글 검색 결과의 댓글 행은 ub-content가 아니라 .search_comment다.
 */
export const WRITER_ROW_SELECTOR = ".ub-content, .search_comment";

/** 글 목록의 글 행. 글 보기 머리·댓글과 댓글 검색 결과의 댓글 행(.search_comment)은 들지 않는다. */
export const LIST_ROW_SELECTOR = ".gall_list .ub-content";

/**
 * 목록 행을 갈아끼우거나 붙인 뒤 부른다. 디시는 자체 차단·이용자 메모 표시를 로드 때만 걸므로, 배경이 페이지(MAIN world)에서 다시 건다
 * (콘텐츠 스크립트에선 디시 함수를 부를 수 없다). 실패해도(확장이 멈춤 등) 목록은 그대로라 넘긴다.
 */
export const notifyListReplaced = (gallery: string): void => {
    void sendMessage("refresher:listReplaced", gallery).catch(() => {});
};

/**
 * 관리자 목록 행의 체크박스 칸을 만드는 함수를 돌려준다.
 * 실제 마크업과 같도록 기존 행의 칸을 복제해 글 번호만 바꾼다. 그런 행이 없으면 디시의 행 템플릿(갤러리 종류별 *_td-tmpl)을,
 * 그것도 없으면 빈 칸을 쓴다. 번호 없는 행(설문/AD)은 열만 맞추는 빈 칸이다.
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
            // 행을 복제했으면 그 행의 번호일 때만 바꾼다. 템플릿은 값이 자리표시자일 수 있으니 늘 이 글의 번호를 넣는다.
            if (!sampleRow || input.value === sampleRow.dataset.no) input.value = no;
        }
        return cell;
    };
};

/**
 * 받아온 행에 체크박스 칸을 채우는 함수를 돌려준다. list는 행을 넣을 지금 목록이다.
 * 관리자 목록은 머리에 체크박스 열이 있는데 받아온 행엔 그 칸이 없다 (디시 JS가 나중에 붙인다). 채우지 않으면 열이 한 칸씩 밀린다.
 * 댓글 검색 결과(commentSearch)에선 댓글 행에만 체크박스가 있다.
 */
export const checkboxFiller = (list: HTMLElement, commentSearch: boolean): ((row: HTMLTableRowElement) => void) => {
    if (!list.closest("table")?.querySelector("thead .chkbox_th")) return () => {};

    const cellOf = checkboxCellFactory(Array.from(list.querySelectorAll<HTMLTableRowElement>(":scope > tr")));
    return (row) => {
        if (row.querySelector(".article_chkbox") || (commentSearch && !row.classList.contains("search_comment"))) return;
        row.prepend(cellOf(row.dataset.no));
    };
};

/** 제목 링크 안의 검색어를 span.mark로 감싼다. 텍스트 노드만 바꿔 링크 안의 다른 요소는 건드리지 않는다. */
export const highlightSearchResults = (newList: HTMLElement, searchValue: string): void => {
    if (!searchValue) return;

    for (const gallTit of newList.querySelectorAll<HTMLElement>(".gall_tit")) {
        const anchor = gallTit.querySelector<HTMLElement>("a:first-child");
        if (!anchor) continue;

        const className = anchor.querySelector(".spoiler") ? "mark spoiler" : "mark";

        const walker = anchor.ownerDocument.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

        for (const node of textNodes) {
            const [first = "", ...rest] = node.data.split(searchValue);
            if (rest.length === 0) continue;

            const mark = (): HTMLSpanElement => Object.assign(anchor.ownerDocument.createElement("span"), {className, textContent: searchValue});
            node.replaceWith(first, ...rest.flatMap((text) => [mark(), text]));
        }
    }
};
