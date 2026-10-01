import {postKey} from "@/core/preview/cache";
import type {GalleryPreData} from "@/core/preview/types";
import {moduleDataKey, moduleDataStorage} from "@/core/storage/items";
import {watchStorage} from "@/core/storage/sync";

import type {Ctx} from "./meta";
import {buildPreData, ROW_SELECTOR} from "./rows";

/** 기억하는 글 수. 넘으면 오래전에 연 글부터 잊는다. */
const MAX_READ = 3000;
const READ_CLASS = "refresherRead";

/** 저장소의 읽은 글 (moduleDataStorage라 백업·내보내기에서 빠진다). 연 순서대로 postKey가 쌓인다. */
interface ReadData {
    read?: string[];
}

/**
 * 미리보기로 연 글을 목록에서 흐리게 한다 (markRead 설정). 미리보기로 연 글은 브라우저 방문 기록에 남지 않아 방문한 글 색이 바뀌지 않는다.
 * 다른 탭에서 연 글도 저장소 감시로 받는다. markAll은 설정이 바뀌면 부른다.
 */
export const createReadMarks = (ctx: Ctx) => {
    // 만드는 순간 값을 읽으므로 setup에서 만든다.
    const storage = moduleDataStorage<ReadData>("preview", {});
    let read = new Set<string>();

    const markRow = (row: HTMLElement): void => {
        const pre = ctx.settings.markRead && read.size > 0 ? buildPreData(row) : null;
        row.classList.toggle(READ_CLASS, pre !== null && read.has(postKey(pre)));
    };
    const markAll = (): void => {
        for (const row of document.querySelectorAll<HTMLElement>(ROW_SELECTOR)) markRow(row);
    };

    // 새로고침으로 들어온 행에도 건다. 읽기 전에 들어온 행은 다 읽은 뒤 markAll이 건다.
    ctx.addFilter(ROW_SELECTOR, markRow);
    void storage.getValue().then(({read: stored}) => {
        if (ctx.signal.aborted) return;
        read = new Set([...stored ?? [], ...read]);
        markAll();
    }, console.error);
    watchStorage<ReadData>(moduleDataKey("preview"), (next) => {
        read = new Set(next?.read ?? []);
        markAll();
    }, ctx.signal);
    ctx.addCleanup(() => {
        for (const row of document.querySelectorAll(`.${READ_CLASS}`)) row.classList.remove(READ_CLASS);
    });

    /** 연 글을 기억한다. 저장소의 최신 값에 더해 다른 탭이 쓴 것을 잃지 않는다. */
    const markRead = (preData: GalleryPreData): void => {
        const key = postKey(preData);
        if (!ctx.settings.markRead || read.has(key)) return;

        read.add(key);
        markAll();
        void storage.getValue()
            .then(({read: stored}) => storage.setValue({read: [...(stored ?? []).filter((item) => item !== key), key].slice(-MAX_READ)}))
            .catch(console.error);
    };

    return {markRead, markAll};
};
