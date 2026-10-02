import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {isBlocked} from "@/core/block";
import {markUsed, syncUsage} from "@/core/usage";
import {findMemo, useMemosStore} from "@/stores/memos";

import {setBlockLists, stored} from "../../helpers";

const KEY = "refresher:usage";

beforeEach(() => {
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout", "Date"]});
    vi.setSystemTime(new Date("2026-01-10T00:00:00Z"));
});

afterEach(() => {
    vi.useRealTimers();
});

describe("markUsed", () => {
    it("모아서 저장하고, 다른 탭이 적은 기록은 남기고 더 늦은 시각을 쓴다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {block: {other: 1, a: 1}, memo: {}}});
        const at = Date.now();
        markUsed("block", "a");
        markUsed("memo", "UID:u");
        expect(await stored(KEY)).toEqual({block: {other: 1, a: 1}, memo: {}});

        await vi.advanceTimersByTimeAsync(5_000);
        await vi.waitFor(async () => expect(await stored(KEY)).toEqual({block: {other: 1, a: at}, memo: {"UID:u": at}}));
    });

    it("차단에 걸린 항목과 찾은 메모를 적는다. 맞지 않은 항목과 다른 갤러리 메모는 적지 않는다", async () => {
        const at = Date.now();
        setBlockLists({NICK: [{id: "hit", content: "ㅇㅇ", isRegex: false}, {id: "miss", content: "ㄴㄴ", isRegex: false}]});
        expect(isBlocked("NICK", "ㅇㅇ")).toBe(true);
        useMemosStore.setState({memos: {UID: {u1: {text: "m", color: "#000"}, u2: {text: "m", color: "#000", gallery: "g"}}, NICK: {}, IP: {}}});
        expect(findMemo({uid: "u1"})).toBeDefined();
        expect(findMemo({uid: "u2"}, "other")).toBeUndefined();

        await vi.advanceTimersByTimeAsync(5_000);
        await vi.waitFor(async () => expect(await stored(KEY)).toEqual({block: {hit: at}, memo: {"UID:u1": at}}));
    });
});

describe("syncUsage", () => {
    it("기록이 없는 항목은 지금으로 채우고 지운 항목의 기록은 버린다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {block: {kept: 5, gone: 5}, memo: {"UID:x": 7}}});
        const times = await syncUsage("block", ["kept", "new"]);
        expect(times).toEqual({kept: 5, new: Date.now()});
        expect(await stored(KEY)).toEqual({block: {kept: 5, new: Date.now()}, memo: {"UID:x": 7}});
    });
});
