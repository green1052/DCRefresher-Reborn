import {BLURRED_ROW_SELECTOR} from "@/core/block";

import type {Ctx} from "./meta";

/** 탭 제목 앞의 새 글 수 "(3) ". */
const TITLE_COUNT = /^\(\d+\) /;

/** 이 모듈이 탭 제목 앞에 수를 붙여 두었는지. 원래 "(1) "로 시작하는 제목(글 제목 등)은 건드리지 않는다. */
let titleCounted = false;

/** 탭 제목 앞에 새 글 수를 붙인다. 0이면 붙여 둔 수를 뗀다. 미리보기가 제목을 바꿔도 앞에 붙은 수만 갈아 쓴다. */
export const setTitleCount = (count: number): void => {
    if (count === 0 && !titleCounted) return;
    const title = titleCounted ? document.title.replace(TITLE_COUNT, "") : document.title;
    titleCounted = count > 0;
    const next = count > 0 ? `(${count}) ${title}` : title;
    if (next !== document.title) document.title = next;
};

/** 사용자가 이 탭을 보고 있는지. 다른 창을 보는 동안(창은 보이지만 포커스가 없다)도 안 보는 것으로 친다. */
const isWatching = (): boolean => !document.hidden && document.hasFocus();

/**
 * 이 탭을 보지 않는 동안 들어온 새 글 수를 탭 제목에 붙인다. 탭으로 돌아오면(창 포커스·탭 표시) 지운다.
 * 가린 글(차단·깡계 숨김과 흐리게)은 세지 않는다. 필터는 행을 넣은 뒤(MutationObserver)에 돌므로 한 차례 뒤에 센다.
 */
export const createUnseenCounter = (ctx: Ctx) => {
    let unseen = 0;

    const count = (rows: HTMLElement[]): void => {
        window.setTimeout(() => {
            if (ctx.signal.aborted || isWatching() || !ctx.settings.titleCount) return;
            unseen += rows.filter((row) => row.isConnected && row.checkVisibility() && !row.closest(BLURRED_ROW_SELECTOR)).length;
            setTitleCount(unseen);
        });
    };

    const clear = (): void => {
        unseen = 0;
        setTitleCount(0);
    };

    const onReturn = (): void => {
        if (isWatching()) clear();
    };
    window.addEventListener("focus", onReturn, {signal: ctx.signal});
    document.addEventListener("visibilitychange", onReturn, {signal: ctx.signal});
    ctx.addCleanup(clear);

    return {count, clear};
};
