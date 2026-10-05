/**
 * @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
 */
import {afterEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {createReadMarks} from "@/features/preview/read";

import {preData, stored, tick} from "../../../helpers";
import {fakeCtx} from "./ctx";
import {appendRow, postHref, renderList, rowOf} from "./list";

const KEY = "refresher:module:preview:data";

let stop = (): void => undefined;
afterEach(() => stop());

const start = (settings: Parameters<typeof fakeCtx>[0] = {}) => {
    const fake = fakeCtx(settings);
    stop = fake.stop;
    return {...fake, marks: createReadMarks(fake.ctx)};
};

const post = (no: number) => preData({id: String(no), link: postHref(no)});
const saveNow = () => window.dispatchEvent(new Event("pagehide"));
const savedRead = async () => {
    const value = await stored(KEY);
    return value && typeof value === "object" && "read" in value ? value.read : undefined;
};
const isRead = (row: HTMLElement) => row.classList.contains("refresherRead");

describe("createReadMarks", () => {
    it("저장된 글을 목록에 표시한다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {read: ["test:2"]}});
        const rows = renderList([{no: 1}, {no: 2}]);
        start();
        await tick();
        expect(isRead(rowOf(rows, 1))).toBe(false);
        expect(isRead(rowOf(rows, 2))).toBe(true);
    });

    it("연 글을 표시하고 5초 뒤 저장한다", async () => {
        const rows = renderList([{no: 1}]);
        const {marks} = start();
        await tick();
        vi.useFakeTimers();
        marks.markRead(post(1));
        expect(isRead(rowOf(rows, 1))).toBe(true);
        await vi.advanceTimersByTimeAsync(4_999);
        expect(await savedRead()).toBeUndefined();
        await vi.advanceTimersByTimeAsync(1);
        expect(await savedRead()).toEqual(["test:1"]);
    });

    it("읽기 전에 연 글도 지난 기록을 덮지 않는다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {read: ["test:2"]}});
        renderList([{no: 1}, {no: 2}]);
        const {marks} = start();
        marks.markRead(post(1));
        saveNow();
        await tick();
        // 읽기 전의 저장은 건너뛰고, 다 읽은 뒤 다시 잡은 저장이 둘을 합쳐 쓴다.
        saveNow();
        await tick();
        expect(await savedRead()).toEqual(["test:2", "test:1"]);
    });

    it("최근 3000개만 남긴다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {read: Array.from({length: 3000}, (_, index) => `old:${index}`)}});
        const {marks} = start();
        await tick();
        marks.markRead(post(1));
        saveNow();
        await tick();
        const read = await savedRead();
        expect(Array.isArray(read) && [read.length, read[0], read.at(-1)]).toEqual([3000, "old:1", "test:1"]);
    });

    it("다시 연 글은 맨 뒤로 옮긴다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {read: ["test:1", "a:1"]}});
        const {marks} = start();
        await tick();
        marks.markRead(post(1));
        saveNow();
        await tick();
        expect(await savedRead()).toEqual(["a:1", "test:1"]);
    });

    it("다른 탭이 저장해도 이 탭의 글을 남긴다", async () => {
        const rows = renderList([{no: 1}, {no: 2}]);
        const {marks} = start();
        await tick();
        marks.markRead(post(1));
        await fakeBrowser.storage.local.set({[KEY]: {read: ["test:2"]}});
        await tick();
        expect(isRead(rowOf(rows, 1))).toBe(true);
        expect(isRead(rowOf(rows, 2))).toBe(true);
        saveNow();
        await tick();
        expect(await savedRead()).toEqual(["test:2", "test:1"]);
    });

    it("새로 들어온 행에도 표시한다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {read: ["test:3"]}});
        renderList([{no: 1}]);
        start();
        await tick();
        const row = appendRow({no: 3});
        await tick();
        expect(isRead(row)).toBe(true);
    });

    it("설정을 끄면 표시를 떼고 기억하지 않는다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {read: ["test:1"]}});
        const rows = renderList([{no: 1}, {no: 2}]);
        const {marks, change} = start();
        await tick();
        change({markRead: false});
        expect(isRead(rowOf(rows, 1))).toBe(false);
        marks.markRead(post(2));
        saveNow();
        await tick();
        expect(isRead(rowOf(rows, 2))).toBe(false);
        expect(await savedRead()).toEqual(["test:1"]);
    });

    it("모듈이 멈추면 표시를 떼고 남은 글을 저장한다", async () => {
        const rows = renderList([{no: 1}]);
        const {marks} = start();
        await tick();
        marks.markRead(post(1));
        stop();
        await tick();
        expect(isRead(rowOf(rows, 1))).toBe(false);
        expect(await savedRead()).toEqual(["test:1"]);
    });
});
