import {postKey} from "@/core/preview/cache";
import type {GalleryPreData} from "@/core/preview/types";
import {moduleDataKey, moduleDataStorage} from "@/core/storage/items";
import {watchStorage} from "@/core/storage/sync";

import type {Ctx} from "./meta";
import {buildPreData, ROW_SELECTOR} from "./rows";

/** 기억하는 글 수. 넘으면 오래전에 연 글부터 잊는다. */
const MAX_READ = 3000;
const READ_CLASS = "refresherRead";
/**
 * 연 글을 모아 저장하는 간격 (ms). 저장할 때마다 목록 전체(수십 KB)가 열린 디시 탭마다 전달되므로 글을 넘길 때마다 쓰지 않는다.
 * 탭을 숨기거나 떠날 때도 저장한다.
 */
const SAVE_DELAY = 5_000;

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
    // 저장소를 다 읽었는지. 그 전에 쓰면 지난 기록을 덮어 지운다.
    let loaded = false;
    // 이 탭에서 열었지만 아직 저장하지 않은 글.
    let unsaved: string[] = [];
    let saveTimer = 0;

    // 저장소를 다시 읽지 않고 한 번에 쓴다. 페이지를 떠날 때는 읽고 쓰는 두 번째 호출까지 가지 못한다.
    // read는 감시가 다른 탭의 값과 합쳐 두었다.
    const save = (): void => {
        window.clearTimeout(saveTimer);
        saveTimer = 0;
        if (!loaded || unsaved.length === 0) return;
        const batch = new Set(unsaved);
        void storage.setValue({read: [...read].slice(-MAX_READ)}).then(() => {
            unsaved = unsaved.filter((key) => !batch.has(key));
        }, console.error);
    };
    document.addEventListener("visibilitychange", () => document.hidden && save(), {signal: ctx.signal});
    window.addEventListener("pagehide", save, {signal: ctx.signal});

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
        loaded = true;
        markAll();
        if (unsaved.length > 0) saveTimer ||= window.setTimeout(save, SAVE_DELAY);
    }, console.error);
    // 다른 탭이 저장한 것을 받는다. 아직 저장하지 않은 이 탭의 글은 남긴다.
    watchStorage<ReadData>(moduleDataKey("preview"), (next) => {
        read = new Set([...next?.read ?? [], ...unsaved]);
        markAll();
    }, ctx.signal);
    ctx.addCleanup(save);
    ctx.addCleanup(() => {
        for (const row of document.querySelectorAll(`.${READ_CLASS}`)) row.classList.remove(READ_CLASS);
    });

    /** 연 글을 기억한다. 저장은 모아서 한다 (SAVE_DELAY). */
    const markRead = (preData: GalleryPreData): void => {
        const key = postKey(preData);
        if (!ctx.settings.markRead || read.has(key)) return;

        read.add(key);
        unsaved.push(key);
        markAll();
        saveTimer ||= window.setTimeout(save, SAVE_DELAY);
    };

    return {markRead, markAll};
};
