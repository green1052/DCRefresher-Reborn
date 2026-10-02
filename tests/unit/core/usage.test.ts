import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {isAnyBlocked} from "@/core/block";
import {sendMessage} from "@/core/messaging/protocol";
import {markUsed, recordUsage, syncUsage} from "@/core/usage";
import {findMemo, useMemosStore} from "@/stores/memos";

import {setBlockLists, stored} from "../../helpers";

vi.mock("@/core/messaging/protocol", () => ({sendMessage: vi.fn(async () => undefined)}));

const KEY = "refresher:usage";

beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout", "Date"]});
    vi.setSystemTime(new Date("2026-01-10T00:00:00Z"));
});

afterEach(() => {
    vi.useRealTimers();
});

describe("markUsed", () => {
    it("함께 걸린 항목을 모두 적고, 맞지 않은 항목과 다른 갤러리 메모는 적지 않는다. 모아서 배경에 한 번 보낸다", async () => {
        const at = Date.now();
        // 같은 유저를 닉네임과 아이디로 함께 막았다. 닉네임에서 막혀도 아이디 항목까지 적는다.
        setBlockLists({NICK: [{id: "nick", content: "ㅇㅇ", isRegex: false}, {id: "miss", content: "ㄴㄴ", isRegex: false}], ID: [{id: "uid", content: "u1", isRegex: false}]});
        expect(isAnyBlocked({NICK: "ㅇㅇ", ID: "u1"})).toBe(true);
        useMemosStore.setState({memos: {UID: {u1: {text: "m", color: "#000"}, u2: {text: "m", color: "#000", gallery: "g"}}, NICK: {}, IP: {}}});
        expect(findMemo({uid: "u1"})).toBeDefined();
        expect(findMemo({uid: "u2"}, "other")).toBeUndefined();
        // 한 시간 안에 다시 걸려도 또 적지 않는다.
        markUsed("block", "nick");

        expect(sendMessage).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(sendMessage).toHaveBeenCalledTimes(1);
        expect(sendMessage).toHaveBeenCalledWith("refresher:markUsed", {block: {nick: at, uid: at}, memo: {"UID:u1": at}});
    });
});

describe("recordUsage / syncUsage (배경)", () => {
    it("동시에 와도 서로의 기록을 덮지 않는다", async () => {
        await fakeBrowser.storage.local.set({[KEY]: {block: {kept: 5, gone: 5}, memo: {"UID:x": 7}}});
        const [, times] = await Promise.all([
            recordUsage({block: {kept: 9, other: 9}, memo: {"UID:x": 8}}),
            syncUsage("block", ["kept", "new"])
        ]);
        // 먼저 온 기록을 본 뒤에 맞춘다. other는 목록에 없으니 버리고, 기록이 없는 new는 지금으로 둔다.
        expect(times).toEqual({kept: 9, new: Date.now()});
        expect(await stored(KEY)).toEqual({block: {kept: 9, new: Date.now()}, memo: {"UID:x": 8}});

        // 더 이른 시각은 늦은 기록을 덮지 않는다.
        await recordUsage({block: {kept: 1}, memo: {}});
        expect((await stored(KEY) as { block: Record<string, number> }).block.kept).toBe(9);
    });
});
