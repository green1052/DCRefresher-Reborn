import {isViewPage, pagePostNo, rowPostNo, writerFilter} from "@/core/http/urls";
import {checkboxFiller, highlightSearchResults, PAGING_SELECTOR} from "@/core/list";
import {hash53} from "@/utils/hash";

import {COUNT_CELLS, COUNT_TEXT, NOTICE_ICON} from "./markup";

// 받아온 목록을 지금 목록 자리에 넣는 일. 요청, 주기와 상관없이 DOM만 다룬다.

export const clearNewPost = (row: HTMLElement): void => {
    row.classList.remove("refresherNewPost");
    row.style.removeProperty("animation-delay");
};

/** 새 글 판정용 행 키. 번호 없는 행(설문, AD, 다른 갤러리 공지)은 번호 칸 글자로 구분한다. */
const rowKey = (row: HTMLElement): string => rowPostNo(row) ?? row.querySelector(".gall_num")?.textContent ?? "";

/** 수 칸을 비운 행 HTML의 해시. 틀이 같으면 갈아끼우지 않고 수만 고친다. */
const rowFrames = new WeakMap<Element, number>();
const frameOf = (html: string): number => hash53(html.replace(COUNT_TEXT, "$1"));

const syncCounts = (target: Element, source: Element): void => {
    const sources = source.querySelectorAll(COUNT_CELLS);
    for (const [index, cell] of target.querySelectorAll(COUNT_CELLS).entries()) {
        const text = sources[index]?.textContent ?? "";
        // 같으면 두어 DOM 변경(필터 감시)을 만들지 않는다.
        if (cell.textContent !== text) cell.textContent = text;
    }
};

/** 새 목록에 빠진 글 행을 붉게 제자리에 남긴다. 새 글 n개가 들어오면 맨 아래 n개는 밀려난 것이니 남기지 않는다. */
const keepDeletedRows = (oldRows: HTMLTableRowElement[], newKeys: Set<string>, newList: HTMLElement, newPostCount: number, first: Element | null): void => {
    const newRows = new Map(Array.from(newList.querySelectorAll<HTMLTableRowElement>(":scope > tr"), (row) => [rowKey(row), row]));
    // 받은 행 수. 한 페이지가 안 차는 갤러리는 목록이 길어지므로, 옛 행 수가 아니라 남긴 행 수만큼만 뺀다.
    const received = newList.children.length;

    // 옛 목록에서 바로 아래에 있던 행 앞에 끼운다. 위 행 뒤에 끼우면 공지 아래 글이 새 글보다 위에 붙박인다.
    let next = first;
    for (let index = oldRows.length - 1; index >= 0; index--) {
        const row = oldRows[index]!;
        const no = rowPostNo(row);
        // 번호 없는 행(설문, AD)과 공지는 늘 새로 받는다. 공지에서 내린 글은 지워진 것이 아니다.
        if (!no || row.querySelector(NOTICE_ICON) || newKeys.has(no) || index >= oldRows.length - newPostCount) {
            next = newRows.get(rowKey(row)) ?? next;
            continue;
        }

        // 떼었다 붙인 요소는 애니메이션이 다시 돈다. 새 글 등장 효과를 떼어 새로고침마다 다시 나타나지 않게 한다.
        clearNewPost(row);
        row.classList.add("refresherDeleted");
        const copy = row.cloneNode(true) as HTMLTableRowElement;
        const frame = rowFrames.get(row);
        if (frame !== undefined) rowFrames.set(copy, frame);
        newList.insertBefore(copy, next);
        next = copy;
    }

    while (newList.children.length > Math.max(oldRows.length, received)) newList.lastElementChild?.remove();
};

/** 새 목록이 옛 목록의 한 자리에 count개 끼어들고 아래가 그만큼 잘렸으면 그 자리와 개수, 아니면 null. */
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

/** 페이징 박스를 받아온 것으로 맞춘다. 같을 땐 건드리지 않아야 누르던 페이지 링크가 교체로 사라지지 않는다. */
export const syncPaging = (dom: Document): void => {
    const paging = dom.querySelector<HTMLElement>(PAGING_SELECTOR);
    const currentPaging = document.querySelector<HTMLElement>(PAGING_SELECTOR);
    if (paging && currentPaging && paging.innerHTML !== currentPaging.innerHTML) currentPaging.innerHTML = paging.innerHTML;
};

interface ReplaceOptions {
    /** 주소를 바꾼 로드(페이지 넘김, 뒤로 가기)다. 다른 목록이라 새 글 효과, 삭제된 글 보존을 하지 않는다. */
    navigated: boolean;
    /** 검색 결과 목록이면 검색어 (강조할 값). */
    search: string | undefined;
    /** 검색 종류 (s_type). */
    searchType: string | null;
    fadeIn: boolean;
    /** 빠진 글을 삭제된 글로 남긴다 (미리보기의 archiveArticle). */
    keepDeleted: boolean;
}

/** 새 글이 들어오고 빠진 글이 지워진 글인, 거르기 없는 1페이지인지. 작성자 거르기는 다음 쪽을 이어 붙인다. */
export const isWholeFirstPage = (url: string): boolean => {
    const params = new URL(url).searchParams;
    return (params.get("page") ?? "1") === "1" && !params.has("exception_mode") && !params.has("search_head") && !writerFilter(url);
};

/** 제목·작성자로 같은 행인지 본다. 수 칸 개수도 같아야 syncCounts가 밀리지 않는다. */
const sameRow = (a: Element, b: Element): boolean => {
    const title = (row: Element) => row.querySelector(".gall_tit > a")?.textContent;
    const writer = (row: Element) => {
        const cell = row.querySelector<HTMLElement>(".ub-writer");
        return cell && `${cell.dataset.nick}|${cell.dataset.uid}|${cell.dataset.ip}`;
    };
    const counts = (row: Element) => row.querySelectorAll(COUNT_CELLS).length;
    return title(a) === title(b) && writer(a) === writer(b) && counts(a) === counts(b);
};

/** 받아온 목록을 지금 목록 자리에 넣고 새 글 행(added)과 행을 고쳤는지(changed)를 돌려준다. */
export const replaceList = (oldList: HTMLElement, newList: HTMLElement, {navigated, search, searchType, fadeIn, keepDeleted}: ReplaceOptions): { added: HTMLTableRowElement[]; changed: boolean } => {
    const oldRows = Array.from(oldList.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
    const oldKeys = oldRows.map(rowKey);
    const oldCacheSet = new Set(oldKeys);

    const newRows = Array.from(newList.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
    const newKeys = newRows.map(rowKey);
    const newPostList: HTMLTableRowElement[] = [];
    // 남아 있던 마지막 글보다 아래의 새 행은 지워진 글이 올라온 것이니 새 글이 아니다.
    const lastKept = newKeys.findLastIndex((key) => oldCacheSet.has(key));

    const commentSearch = searchType === "search_comment";
    const fillCheckbox = checkboxFiller(oldList, commentSearch);

    for (const [index, element] of newRows.entries()) {
        const no = newKeys[index]!;
        rowFrames.set(element, frameOf(element.outerHTML));
        fillCheckbox(element);
        // 받아온 목록의 썸네일은 즉시 받기라, 글 보기 아래 목록(디시는 lazy)을 갈아끼우면 화면 밖 썸네일까지 한꺼번에 받는다.
        for (const img of element.querySelectorAll("img")) img.loading = "lazy";

        if (isViewPage && no === pagePostNo) {
            element.classList.add("crt");
            const gallNum = element.querySelector<HTMLElement>(".gall_num");
            if (gallNum) gallNum.innerHTML = "<span class=\"sp_img crt_icon\"> </span>";
            continue;
        }

        if (!oldCacheSet.has(no) && (lastKept === -1 || index < lastKept)) newPostList.push(element);
    }

    // 받아온 HTML엔 검색어 강조가 없으니 페이지 전환뿐 아니라 받아온 목록마다 칠한다.
    if (search !== undefined) highlightSearchResults(newList, search, commentSearch);

    if (!navigated && fadeIn) {
        for (const [index, element] of newPostList.entries()) {
            element.classList.add("refresherNewPost");
            // 새 행이 많아도 마지막 행이 한참 뒤에 나타나지 않게 지연에 상한을 둔다.
            element.style.animationDelay = `${Math.min(newPostList.length - index, 10) * 50}ms`;
        }
    }

    // 같은 목록을 다시 받을 때만 한다. 페이지를 넘겼거나 검색 결과면 빠진 글이 지워진 것이 아니다.
    if (keepDeleted && !navigated && search === undefined) {
        keepDeletedRows(oldRows, new Set(newKeys), newList, newPostList.length, newRows[lastKept + 1] ?? null);
    }

    // 순서가 같거나 한 자리에 새 글이 끼어든 것뿐이면 제자리에서 고친다 (hover·리스너 유지). 검색 결과는 통째로 바꾼다.
    const rows = keepDeleted ? Array.from(newList.querySelectorAll<HTMLTableRowElement>(":scope > tr")) : newRows;
    const shift = !navigated && search === undefined ? insertionOf(oldKeys, rows.map(rowKey)) : null;
    if (shift) {
        const {at, count} = shift;
        const removed = oldRows.slice(rows.length - count);
        for (const row of removed) row.remove();
        const anchor = at < rows.length - count ? oldRows[at]! : null;
        for (const row of rows.slice(at, at + count)) oldList.insertBefore(row, anchor);
        let changed = count > 0 || removed.length > 0;
        for (const [index, row] of rows.entries()) {
            if (index >= at && index < at + count) continue;
            const old = oldRows[index < at ? index : index - count]!;
            // 페이지가 처음 그린 행은 틀이 없다(다른 모듈이 이미 고쳐 원래 HTML을 모른다). 제목, 작성자가 같으면 받아온 행의 틀을 물려준다.
            if (!rowFrames.has(old) && sameRow(old, row)) rowFrames.set(old, rowFrames.get(row) ?? -1);
            if (rowFrames.get(old) === rowFrames.get(row)) {
                // 남긴 행은 원래 행과 틀이 같아 그대로 둔다. 지웠던 글이 다시 받아지면 붉은 표시를 받아온 행에 맞춰 뗀다.
                old.classList.toggle("refresherDeleted", row.classList.contains("refresherDeleted"));
                syncCounts(old, row);
                continue;
            }
            old.replaceWith(row);
            changed = true;
        }
        return {added: newPostList, changed};
    }

    oldList.replaceWith(newList);
    return {added: newPostList, changed: true};
};
