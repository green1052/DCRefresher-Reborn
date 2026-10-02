import {postKey} from "@/core/preview/cache";
import type {GalleryPreData} from "@/core/preview/types";
import {smoothScroll} from "@/utils/dom";
import {isTyping} from "@/utils/event";

import type {Ctx} from "./meta";
import {isBlurHidden, type ListRow, listRows, ROW_SELECTOR, rowPostKey} from "./rows";
import {usePreviewStore} from "./ui/previewStore";

const SELECTED_CLASS = "refresherSelected";

/**
 * 목록 키보드 이동 (listKeyboard 설정). J/K로 글을 고르고 Enter로 미리보기, O로 글을 연다. Esc는 선택을 푼다.
 * 키는 위치(code)로 본다. 한글 입력 상태면 key가 'ㅓ'·'ㅏ'로 온다. 미리보기가 열려 있으면 미리보기의 키(PageUp/Down 등)에 맡긴다.
 */
export const bindListKeys = (ctx: Ctx, open: (preData: GalleryPreData) => void): void => {
    // 고른 글. 새로고침으로 행이 바뀌어도 같은 글을 다시 표시한다.
    let selected: string | null = null;

    const rows = (): ListRow[] => listRows().filter(({row}) => !isBlurHidden(row));

    const select = (entry: ListRow | undefined): void => {
        for (const row of document.querySelectorAll(`.${SELECTED_CLASS}`)) row.classList.remove(SELECTED_CLASS);
        selected = entry ? postKey(entry.pre) : null;
        if (!entry) return;
        entry.row.classList.add(SELECTED_CLASS);
        entry.row.scrollIntoView({block: "nearest", behavior: smoothScroll()});
    };

    const move = (dir: number): void => {
        const list = rows();
        const index = list.findIndex(({pre}) => postKey(pre) === selected);
        // 처음 누르면 화면에 보이는 첫 행을 고른다.
        const next = index < 0 ? list.find(({row}) => row.getBoundingClientRect().top >= 0) ?? list[0] : list[Math.max(0, Math.min(list.length - 1, index + dir))];
        select(next);
    };

    const onKey = (ev: KeyboardEvent): void => {
        // 다른 창(디시 레이어 등)이 이미 쓴 키(Esc 등)는 받지 않는다.
        if (!ctx.settings.listKeyboard || ev.defaultPrevented || ev.ctrlKey || ev.altKey || ev.metaKey || isTyping(ev)) return;
        if (usePreviewStore.getState().visible) return;

        const current = (): ListRow | undefined => rows().find(({pre}) => postKey(pre) === selected);
        // Enter·O·Esc는 고른 글이 있을 때만 받는다. 링크에 포커스가 있으면 Enter는 그 링크 몫이다.
        const idle = document.activeElement === null || document.activeElement === document.body;

        if (ev.code === "KeyJ" || ev.code === "KeyK") {
            move(ev.code === "KeyJ" ? 1 : -1);
        } else if (selected && idle && (ev.code === "Enter" || ev.code === "NumpadEnter") && !ev.repeat) {
            const entry = current();
            if (!entry) return;
            open(entry.pre);
        } else if (selected && idle && ev.code === "KeyO" && !ev.repeat) {
            const entry = current();
            if (!entry) return;
            location.href = entry.pre.link;
        } else if (selected && ev.code === "Escape") {
            select(undefined);
        } else {
            return;
        }
        ev.preventDefault();
    };
    window.addEventListener("keydown", onKey, {signal: ctx.signal});

    // 새로고침으로 바뀐 행에도 다시 표시한다.
    ctx.addFilter(ROW_SELECTOR, (row) => {
        if (selected && rowPostKey(row) === selected) row.classList.add(SELECTED_CLASS);
    });

    // 미리보기에서 PageUp/Down으로 넘긴 뒤 닫으면 마지막으로 본 글을 고른다. 키보드로 고르던 중일 때만.
    ctx.addCleanup(usePreviewStore.subscribe((state, previous) => {
        if (!selected || !previous.visible || state.visible || !previous.preData) return;
        const key = postKey(previous.preData);
        const entry = rows().find(({pre}) => postKey(pre) === key);
        if (entry) select(entry);
    }));
    ctx.addCleanup(() => select(undefined));
};
