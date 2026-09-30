import {isViewPage, pagePostNo, rowPostNo} from "@/core/http/urls";
import {checkboxFiller, highlightSearchResults, PAGING_SELECTOR} from "@/core/list";

// 받아온 목록을 지금 목록 자리에 넣는 일. 요청·주기와 상관없이 DOM만 다룬다

/** 새 글 판정용 행 키. 번호 없는 행(설문·AD, 다른 갤러리 공지)은 번호 칸 글자로 구분한다 */
const rowKey = (row: HTMLElement): string => rowPostNo(row) ?? row.querySelector(".gall_num")?.textContent ?? "";

/** 받아온 행의 원래 HTML (체크박스 칸·강조·효과를 입히기 전). 행 순서가 같을 때 바뀐 행을 가려내는 데 쓴다 */
const rawRows = new WeakMap<Element, string>();

/**
 * 새 목록에서 빠진 글 행을 제자리에 남기고 붉게 칠한다 (v5의 삭제된 글 보존). 한 번 남긴 행은 다음 새로고침에도 남는다.
 * 위에 새 글이 n개 들어오면 맨 아래 n개는 다음 페이지로 밀려난 것이라 남기지 않는다. 행 수는 원래대로 맞춘다.
 * first: 남아 있던 마지막 글 다음 행(다음 페이지에서 올라온 첫 행). 맨 아래 글이 지워졌을 때 그 앞에 끼워야 행 수를 맞출 때 잘리지 않는다
 */
const keepDeletedRows = (oldRows: HTMLTableRowElement[], newKeys: Set<string>, newList: HTMLElement, newPostCount: number, first: Element | null): void => {
    const newRows = new Map(Array.from(newList.children, (row) => [rowKey(row as HTMLElement), row]));

    // 옛 목록에서 바로 아래에 있던 행 앞에 끼운다. 새 글이 위에 들어오면 같이 내려가다 다음 페이지로 밀려난다.
    // 위 행 뒤에 끼우면 공지 바로 아래 글이 새 글보다 위에 붙박이고, 인덱스로 세면 새로고침마다 조금씩 밀린다
    let next = first;
    for (let index = oldRows.length - 1; index >= 0; index--) {
        const row = oldRows[index]!;
        const no = rowPostNo(row);
        // 번호 없는 행(설문·AD)과 공지는 늘 새로 받는다. 공지에서 내린 글은 지워진 것이 아니다
        if (!no || row.querySelector("em[class*=icon_notice]") || newKeys.has(no) || index >= oldRows.length - newPostCount) {
            next = newRows.get(rowKey(row)) ?? next;
            continue;
        }

        row.classList.add("refresherDeleted");
        newList.insertBefore(row, next);
        next = row;
    }

    while (newList.children.length > oldRows.length) newList.lastElementChild?.remove();
};

/**
 * 새 목록이 옛 목록의 한 자리(at)에 행 count개가 끼어들고 그만큼 아래가 잘린 모양이면 그 자리와 개수, 아니면 null.
 * 순서가 같으면 count는 0이다. 자리로 짝지으므로 키가 겹치는 행(번호 없는 설문·AD)도 된다
 */
const insertionOf = (oldKeys: string[], newKeys: string[]): { at: number; count: number } | null => {
    let at = 0;
    while (at < oldKeys.length && at < newKeys.length && oldKeys[at] === newKeys[at]) at++;
    const count = at === oldKeys.length || at === newKeys.length ? Math.max(newKeys.length - oldKeys.length, 0) : newKeys.indexOf(oldKeys[at]!, at + 1) - at;
    if (count < 0) return null;
    for (let index = at + count; index < newKeys.length; index++) {
        if (newKeys[index] !== oldKeys[index - count]) return null;
    }
    return {at, count};
};

/** 페이징 박스를 받아온 것으로 맞춘다. 같을 땐 건드리지 않아야 누르던 페이지 링크가 교체로 사라지지 않는다 */
export const syncPaging = (dom: Document): void => {
    const paging = dom.querySelector<HTMLElement>(PAGING_SELECTOR);
    const currentPaging = document.querySelector<HTMLElement>(PAGING_SELECTOR);
    if (paging && currentPaging && paging.innerHTML !== currentPaging.innerHTML) currentPaging.innerHTML = paging.innerHTML;
};

interface ReplaceOptions {
    /** 주소를 바꾼 로드(페이지 넘김·뒤로 가기)다. 다른 목록이라 새 글 효과·삭제된 글 보존을 하지 않는다 */
    navigated: boolean;
    /** 검색 결과 목록이면 검색어 (강조할 값) */
    search: string | undefined;
    /** 검색 종류 (s_type) */
    searchType: string | null;
    fadeIn: boolean;
    /** 빠진 글을 삭제된 글로 남긴다 (미리보기의 archiveArticle) */
    keepDeleted: boolean;
}

/** 받아온 목록(newList)을 지금 목록(oldList) 자리에 넣고, 새로 들어온 글 행을 돌려준다 */
export const replaceList = (oldList: HTMLElement, newList: HTMLElement, {navigated, search, searchType, fadeIn, keepDeleted}: ReplaceOptions): HTMLTableRowElement[] => {
    const oldRows = Array.from(oldList.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
    const oldKeys = oldRows.map(rowKey);
    const oldCacheSet = new Set(oldKeys);

    const newRows = Array.from(newList.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
    const newKeys = newRows.map(rowKey);
    const newPostList: HTMLTableRowElement[] = [];
    // 남아 있던 글 가운데 마지막 것보다 아래에 나타난 행은 위 글이 지워져 다음 페이지에서 올라온 것이라 새 글이 아니다.
    // 남은 글이 하나도 없으면(한꺼번에 많이 올라온 경우) 모두 새 글로 본다
    const lastKept = newKeys.findLastIndex((key) => oldCacheSet.has(key));

    const fillCheckbox = checkboxFiller(oldList, searchType === "search_comment");

    for (const [index, element] of newRows.entries()) {
        const no = newKeys[index]!;
        rawRows.set(element, element.outerHTML);
        fillCheckbox(element);

        if (isViewPage && no === pagePostNo) {
            element.classList.add("crt");
            const gallNum = element.querySelector<HTMLElement>(".gall_num");
            if (gallNum) gallNum.innerHTML = "<span class=\"sp_img crt_icon\"> </span>";
            continue;
        }

        if (!oldCacheSet.has(no) && (lastKept === -1 || index < lastKept)) newPostList.push(element);
    }

    // 받아온 HTML엔 검색어 강조가 없으니 페이지 전환뿐 아니라 받아온 목록마다 칠한다
    if (search !== undefined) highlightSearchResults(newList, search);

    if (!navigated && fadeIn) {
        for (const [index, element] of newPostList.entries()) {
            element.classList.add("refresherNewPost");
            // 새 행이 많아도 마지막 행이 한참 뒤에 나타나지 않게 지연에 상한을 둔다
            element.style.animationDelay = `${Math.min(newPostList.length - index, 10) * 50}ms`;
        }
    }

    // 같은 목록을 다시 받을 때만 한다. 페이지를 넘겼거나 검색 결과면 빠진 글이 지워진 것이 아니다
    if (keepDeleted && !navigated && search === undefined) {
        keepDeletedRows(oldRows, new Set(newKeys), newList, newPostList.length, newRows[lastKept + 1] ?? null);
    }

    // 행 순서가 같거나, 한 자리(공지 아래)에 새 글이 끼어들고 그만큼 아래가 밀려난 것뿐이면 제자리에서 고친다.
    // 새 행을 끼우고 밀려난 행을 빼고, 나머지는 바뀐 행(조회수 등)만 갈아끼운다. 그대로인 행은 hover·리스너가 남고 필터·스타일·배치도 다시 하지 않는다.
    // 검색 결과는 강조와 글·댓글 행 짝이 얽혀 있어 통째로 바꾼다. 삭제된 글 보존은 옛 행을 새 목록으로 옮겨 넣으므로 순서가 같을 때만 제자리에서 고친다
    const shift = !navigated && search === undefined ? insertionOf(oldKeys, newKeys) : null;
    if (shift && (!keepDeleted || (shift.count === 0 && oldKeys.length === newKeys.length))) {
        const {at, count} = shift;
        for (const row of oldRows.slice(newRows.length - count)) row.remove();
        const anchor = at < newRows.length - count ? oldRows[at]! : null;
        for (const row of newRows.slice(at, at + count)) oldList.insertBefore(row, anchor);
        for (const [index, row] of newRows.entries()) {
            if (index >= at && index < at + count) continue;
            const old = oldRows[index < at ? index : index - count]!;
            if (rawRows.get(old) !== rawRows.get(row)) old.replaceWith(row);
        }
    } else {
        oldList.replaceWith(newList);
    }

    return newPostList;
};
