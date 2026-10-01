import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import type {Ctx} from "@/features/preview/meta";
import {createReadMarks} from "@/features/preview/read";

import {stored} from "../../../helpers";

const KEY = "refresher:module:preview:data";
const post = (id: string) => ({gallery: "test", id, link: "", notice: false, recommend: false, type: "icon_txt", commentCount: 0});

let controller: AbortController;
const stubCtx = (): Ctx => ({
    settings: {markRead: true},
    signal: controller.signal,
    addFilter: () => () => undefined,
    addCleanup: () => undefined,
    onSettingsChanged: () => undefined
}) as unknown as Ctx;

/** 모아 저장하는 시간(5초)을 넘기고 저장소 쓰기가 끝날 때까지 돌린다. */
const flushSave = async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(async () => expect(await stored(KEY)).toBeDefined());
};

beforeEach(() => {
    controller = new AbortController();
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout"]});
});

afterEach(() => {
    controller.abort();
    vi.useRealTimers();
});

describe("createReadMarks", () => {
    it("저장소를 다 읽기 전에 연 글도 지난 기록을 덮지 않고 더한다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {read: ["test:1"]}});
        const marks = createReadMarks(stubCtx());
        marks.markRead(post("2"));
        // 읽기가 끝나기 전에 페이지를 떠나도 지난 기록을 덮어쓰지 않는다.
        window.dispatchEvent(new Event("pagehide"));

        await vi.advanceTimersByTimeAsync(5_000);
        await vi.waitFor(async () => expect(await stored(KEY)).toEqual({read: ["test:1", "test:2"]}));
    });

    it("최근 3000개만 남긴다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {read: Array.from({length: 3000}, (_, index) => `test:${index}`)}});
        const marks = createReadMarks(stubCtx());
        await vi.advanceTimersByTimeAsync(0);
        marks.markRead(post("new"));

        await flushSave();
        await vi.waitFor(async () => {
            const read = ((await stored(KEY)) as { read: string[] }).read;
            expect(read).toHaveLength(3000);
            expect(read.at(-1)).toBe("test:new");
            expect(read[0]).toBe("test:1");
        });
    });

    it("다른 탭이 저장해도 이 탭의 저장하지 않은 글을 남긴다", async () => {
        const marks = createReadMarks(stubCtx());
        await vi.advanceTimersByTimeAsync(0);
        marks.markRead(post("mine"));

        await fakeBrowser.storage.local.set({[KEY]: {read: ["test:other"]}});
        await vi.advanceTimersByTimeAsync(5_000);
        await vi.waitFor(async () => expect(await stored(KEY)).toEqual({read: ["test:other", "test:mine"]}));
    });
});
