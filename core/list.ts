// 디시 글 목록 DOM — 목록을 갈아끼우거나 이어 붙이는 모듈(refresh, search)이 같이 쓴다

/** 갈아끼우는 글 목록 tbody — 검색 페이지 아래쪽 통합검색 목록(#kakao_seach_list)은 뺀다 */
export const LIST_SELECTOR = ".gall_list:not([id]) tbody";
export const PAGING_SELECTOR = ".left_content article:has(.gall_listwrap) .bottom_paging_box";

/**
 * 관리자 목록 행의 체크박스 칸을 만드는 함수. 실제 마크업을 따르기 위해 기존 행의 칸을 복제해 글 번호만 바꾸고,
 * 그런 행이 없으면 디시의 행 템플릿(갤러리 종류별 *_td-tmpl), 그것도 없으면 빈 칸을 쓴다.
 * 번호 없는 행(설문/AD)은 빈 칸 — 열 정렬만 맞춘다.
 */
export const checkboxCellFactory = (oldRows: HTMLTableRowElement[]): ((no: string | undefined) => HTMLTableCellElement) => {
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

/** 검색어 강조 (TreeWalker, 텍스트 노드만) */
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
