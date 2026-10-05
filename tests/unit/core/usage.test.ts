import {beforeEach, describe, expect, it, vi} from "vitest";

import type {UsageData} from "@/core/usage";

import {stored} from "../../helpers";

const sent = vi.hoisted(() => new Array<UsageData>());

vi.mock("@/core/messaging/protocol", () => ({
    sendMessage: async (_name: string, batch: UsageData) => {
        sent.push(batch);
    }
}));

const USAGE = "refresher:usage";
const HOUR = 60 * 60 * 1000;

/** 모아 둔 기록·타이머가 모듈에 남으므로 테스트마다 새로 불러온다. */
const load = async (): Promise<typeof import("@/core/usage")> => {
    vi.resetModules();
    return import("@/core/usage");
};

beforeEach(() => {
    sent.length = 0;
});

describe("markUsed", () => {
    beforeEach(() => {
        vi.useFakeTimers({now: 10 * HOUR});
    });

    it("모아서 5초 뒤 한 번에 보낸다", async () => {
        const {markUsed} = await load();
        markUsed("block", "a");
        vi.advanceTimersByTime(1000);
        markUsed("block", "b");
        markUsed("memo", "NICK:닉");

        vi.advanceTimersByTime(3999);
        expect(sent).toEqual([]);
        vi.advanceTimersByTime(1);
        const now = 10 * HOUR + 1000;
        expect(sent).toEqual([{block: {a: 10 * HOUR, b: now}, memo: {"NICK:닉": now}}]);
    });

    it("같은 항목은 1시간에 한 번만 적는다", async () => {
        const {markUsed} = await load();
        markUsed("block", "a");
        vi.advanceTimersByTime(5000);
        markUsed("block", "a");
        vi.advanceTimersByTime(HOUR);
        expect(sent).toHaveLength(1);

        markUsed("block", "a");
        // 차단과 메모는 같은 id여도 다른 항목이다.
        markUsed("memo", "a");
        vi.advanceTimersByTime(5000);
        expect(sent).toHaveLength(2);
        expect(Object.keys(sent[1]!.block)).toEqual(["a"]);
        expect(Object.keys(sent[1]!.memo)).toEqual(["a"]);
    });

    it("보낸 뒤 다시 모으기 시작한다", async () => {
        const {markUsed} = await load();
        markUsed("block", "a");
        vi.advanceTimersByTime(5000);
        markUsed("block", "b");
        vi.advanceTimersByTime(5000);
        expect(sent.map((batch) => Object.keys(batch.block))).toEqual([["a"], ["b"]]);
    });

    it("페이지를 떠나면 기다리지 않고 보낸다", async () => {
        const {markUsed} = await load();
        markUsed("block", "a");
        window.dispatchEvent(new Event("pagehide"));
        expect(sent).toHaveLength(1);

        // 걸려 있던 타이머는 지워 빈 묶음을 다시 보내지 않는다.
        vi.advanceTimersByTime(5000);
        window.dispatchEvent(new Event("pagehide"));
        expect(sent).toHaveLength(1);
    });
});

describe("memoUsageKey", () => {
    it("종류와 대상을 잇는다", async () => {
        const {memoUsageKey} = await load();
        expect(memoUsageKey("NICK", "닉")).toBe("NICK:닉");
    });
});

describe("recordUsage", () => {
    it("저장된 기록과 합치며 더 늦은 시각을 남긴다", async () => {
        const {recordUsage} = await load();
        await browser.storage.local.set({[USAGE]: {block: {a: 100, b: 300}, memo: {m: 1}}});
        await recordUsage({block: {a: 200, b: 250, c: 50}, memo: {}});
        expect(await stored(USAGE)).toEqual({block: {a: 200, b: 300, c: 50}, memo: {m: 1}});
    });

    it("깨진 기록과 숫자가 아닌 값은 버린다", async () => {
        const {recordUsage} = await load();
        await browser.storage.local.set({[USAGE]: {block: {a: "x", b: 1}, memo: "깨짐"}});
        await recordUsage({block: {c: 2}, memo: {d: 3}});
        expect(await stored(USAGE)).toEqual({block: {b: 1, c: 2}, memo: {d: 3}});
    });

    it("동시에 와도 서로의 기록을 덮지 않는다", async () => {
        const {recordUsage, syncUsage} = await load();
        await Promise.all([
            recordUsage({block: {a: 1}, memo: {}}),
            recordUsage({block: {b: 2}, memo: {}}),
            syncUsage("memo", ["m"])
        ]);
        expect(await stored(USAGE)).toMatchObject({block: {a: 1, b: 2}, memo: {m: expect.any(Number)}});
    });
});

describe("syncUsage", () => {
    it("기록이 없는 항목은 지금 쓰인 것으로 두고 지운 항목의 기록은 버린다", async () => {
        const {syncUsage} = await load();
        vi.spyOn(Date, "now").mockReturnValue(999);
        await browser.storage.local.set({[USAGE]: {block: {kept: 5, removed: 6}, memo: {m: 7}}});

        await expect(syncUsage("block", ["kept", "new"])).resolves.toEqual({kept: 5, new: 999});
        expect(await stored(USAGE)).toEqual({block: {kept: 5, new: 999}, memo: {m: 7}});
    });

    it("바뀐 것이 없으면 쓰지 않는다", async () => {
        const {syncUsage} = await load();
        await browser.storage.local.set({[USAGE]: {block: {a: 5}, memo: {}}});
        const set = vi.spyOn(browser.storage.local, "set");

        await expect(syncUsage("block", ["a"])).resolves.toEqual({a: 5});
        expect(set).not.toHaveBeenCalled();
    });
});
