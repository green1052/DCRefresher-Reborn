import {BLURRED_ROW_SELECTOR} from "@/core/block";
import {rowPostNo} from "@/core/http/urls";
import {LIST_SELECTOR} from "@/core/list";

import {NOTICE_ICON} from "./markup";
import type {Ctx} from "./meta";

/** 탭 제목 앞의 새 글 수 "(3) ". */
const TITLE_COUNT = /^\(\d+\) /;

/** 수를 붙였다는 문서 표시. 파이어폭스 재주입 시 새 인스턴스가 옛 인스턴스의 수를 뗄 수 있게 문서에 둔다. */
const COUNTED_ATTRIBUTE = "data-refresher-title-count";

/** 탭 제목 앞에 새 글 수를 붙인다. 0이면 붙여 둔 수를 뗀다. 미리보기가 제목을 바꿔도 앞에 붙은 수만 갈아 쓴다. */
export const setTitleCount = (count: number): void => {
    const root = document.documentElement;
    const titleCounted = root.hasAttribute(COUNTED_ATTRIBUTE);
    if (count === 0 && !titleCounted) return;
    const title = titleCounted ? document.title.replace(TITLE_COUNT, "") : document.title;
    root.toggleAttribute(COUNTED_ATTRIBUTE, count > 0);
    const next = count > 0 ? `(${count}) ${title}` : title;
    if (next !== document.title) document.title = next;
};

/** '여기까지 읽음' 구분선을 그을 행. 탭을 떠날 때 맨 위에 있던 글이다. */
const READ_MARK_CLASS = "refresherReadMark";

/** 목록 맨 위의 보이는 글(공지, 설문, AD 빼고) 번호. */
const topPostNo = (): string | undefined => {
    for (const row of document.querySelectorAll<HTMLElement>(`${LIST_SELECTOR} > tr`)) {
        const no = rowPostNo(row);
        if (no && !row.querySelector(NOTICE_ICON) && row.checkVisibility()) return no;
    }
    return undefined;
};

/** 사용자가 이 탭을 보고 있는지. 다른 창을 보는 동안(창은 보이지만 포커스가 없다)도 안 보는 것으로 친다. */
const isWatching = (): boolean => !document.hidden && document.hasFocus();

/** 떠나 있는 동안 들어온 새 글을 세어 제목에 붙이고, 돌아오면 지우고 읽음 선을 긋는다. 가린 글은 세지 않는다. */
export const createUnseenCounter = (ctx: Ctx) => {
    let unseen = 0;
    // 탭을 떠나 있는지와 떠날 때 맨 위에 있던 글 번호. 창을 옮긴 뒤 탭을 숨기면 두 번 떠나므로 처음 것만 둔다.
    let away = false;
    let leftAt: string | undefined;
    // 숨은 탭에서 돌아온 뒤 첫 로드에 선을 그을 때 쓸 leftAt. 숨은 탭은 돌아온 뒤에야 글이 오는데 그때는 세지 않는다.
    let hiddenAway = false;
    let returnedFrom: string | undefined;
    // 구분선을 그은 글 번호.
    let readMark: string | undefined;

    /** 구분선을 readMark 행에 맞춘다. 목록을 갈아끼우면 행이 바뀌므로 다시 부른다. 같은 상태면 class를 건드리지 않는다. */
    const showMark = (): void => {
        for (const row of document.querySelectorAll<HTMLElement>(`${LIST_SELECTOR} > tr`)) {
            row.classList.toggle(READ_MARK_CLASS, readMark !== undefined && rowPostNo(row) === readMark);
        }
    };

    /** 목록을 받을 때마다 새로 들어온 행으로 부른다. 받은 목록이 그대로였거나 페이지를 넘겼으면 빈 배열이다. */
    const count = (rows: HTMLElement[]): void => {
        const mark = returnedFrom;
        returnedFrom = undefined;
        if (rows.length === 0) return;
        window.setTimeout(() => {
            // 선도 떠난 동안 센 수로 긋는지 정하므로 둘 중 하나만 켜져 있어도 센다.
            if (ctx.signal.aborted || (!ctx.settings.titleCount && !ctx.settings.readMark)) return;
            const added = rows.filter((row) => row.isConnected && row.checkVisibility() && !row.closest(BLURRED_ROW_SELECTOR)).length;
            if (!isWatching()) {
                unseen += added;
                if (ctx.settings.titleCount) setTitleCount(unseen);
            } else if (ctx.settings.readMark && mark !== undefined && added > 0) {
                readMark = mark;
                showMark();
            }
        });
    };

    const clearTitle = (): void => setTitleCount(0);

    const clearMark = (): void => {
        readMark = undefined;
        returnedFrom = undefined;
        showMark();
    };

    const onFocusChange = (): void => {
        if (!isWatching()) {
            if (!away) leftAt = topPostNo();
            away = true;
            hiddenAway ||= document.hidden;
            return;
        }

        // 돌아오면 focus와 visibilitychange가 함께 온다(페이지 안 iframe으로 포커스가 옮겨도 blur가 온다). 떠났다 돌아온 첫 번만 선을 고친다.
        if (away) readMark = ctx.settings.readMark && unseen > 0 ? leftAt : undefined;
        if (hiddenAway) returnedFrom = leftAt;
        away = false;
        hiddenAway = false;
        unseen = 0;
        setTitleCount(0);
        showMark();
    };
    window.addEventListener("focus", onFocusChange, {signal: ctx.signal});
    window.addEventListener("blur", onFocusChange, {signal: ctx.signal});
    document.addEventListener("visibilitychange", onFocusChange, {signal: ctx.signal});
    // 문서 상태를 바꾼 것이므로 onRevoke(모듈을 끈 때)에만 되돌린다. stopAll에서 되돌리면 새 인스턴스의 수와 구분할 표시가 필요해진다.
    ctx.onRevoke(() => {
        clearTitle();
        clearMark();
    });

    return {count, clearTitle, clearMark, showMark};
};
