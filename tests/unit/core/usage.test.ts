// @vitest-environment node
import {describe, expect, it, vi} from "vitest";
import {storage} from "wxt/utils/storage";

import {USAGE_KEY} from "@/core/storage/items";
import {recordUsage, syncUsage} from "@/core/usage";

const HOUR = 60 * 60 * 1000;

describe("recordUsage", () => {
    it("새 항목과 한 시간 넘게 지난 기록만 쓴다", async () => {
        await storage.setItem(USAGE_KEY, {block: {a: 10 * HOUR}, memo: {}});
        const setItem = vi.spyOn(storage, "setItem");

        await recordUsage({block: {a: 10 * HOUR + 1000}, memo: {}});
        expect(setItem).not.toHaveBeenCalled();

        await recordUsage({block: {a: 11 * HOUR}, memo: {"nick:x": 5}});
        expect(setItem).toHaveBeenCalledOnce();
        expect(await storage.getItem(USAGE_KEY)).toEqual({block: {a: 11 * HOUR}, memo: {"nick:x": 5}});
    });

    it("더 이른 시각으로 되돌리지 않는다", async () => {
        await storage.setItem(USAGE_KEY, {block: {a: 10 * HOUR}, memo: {}});
        await recordUsage({block: {a: 5 * HOUR}, memo: {}});
        expect(await storage.getItem(USAGE_KEY)).toEqual({block: {a: 10 * HOUR}, memo: {}});
    });
});

describe("syncUsage", () => {
    it("prune이면 목록에 없는 항목의 기록은 버리고, 기록이 없는 항목은 지금 쓰인 것으로 둔다", async () => {
        vi.useFakeTimers({now: 20 * HOUR});
        await storage.setItem(USAGE_KEY, {block: {kept: 10 * HOUR, removed: 5 * HOUR}, memo: {}});

        expect(await syncUsage("block", ["kept", "added"], true)).toEqual({kept: 10 * HOUR, added: 20 * HOUR});
        expect(await storage.getItem(USAGE_KEY)).toEqual({block: {kept: 10 * HOUR, added: 20 * HOUR}, memo: {}});
    });

    it("prune이 아니면 지운 항목의 기록을 남겨 되돌린 항목이 원래 시각을 지킨다", async () => {
        vi.useFakeTimers({now: 20 * HOUR});
        await storage.setItem(USAGE_KEY, {block: {kept: 10 * HOUR, removed: 5 * HOUR}, memo: {}});
        const setItem = vi.spyOn(storage, "setItem");

        // 지운 직후: 목록에서 빠져도 쓰지 않는다.
        expect(await syncUsage("block", ["kept"], false)).toEqual({kept: 10 * HOUR, removed: 5 * HOUR});
        expect(setItem).not.toHaveBeenCalled();

        // 되돌리면 같은 id가 지금 시각이 아니라 원래 시각으로 돌아온다.
        expect(await syncUsage("block", ["kept", "removed", "added"], false)).toEqual({kept: 10 * HOUR, removed: 5 * HOUR, added: 20 * HOUR});
        expect(await storage.getItem(USAGE_KEY)).toEqual({block: {kept: 10 * HOUR, removed: 5 * HOUR, added: 20 * HOUR}, memo: {}});
    });

    it("바뀐 것이 없으면 쓰지 않는다", async () => {
        await storage.setItem(USAGE_KEY, {block: {a: 10 * HOUR}, memo: {}});
        const setItem = vi.spyOn(storage, "setItem");

        expect(await syncUsage("block", ["a"], true)).toEqual({a: 10 * HOUR});
        expect(setItem).not.toHaveBeenCalled();
    });

    it("다른 종류의 기록은 건드리지 않는다", async () => {
        await storage.setItem(USAGE_KEY, {block: {a: 10 * HOUR}, memo: {"nick:x": 5}});
        await syncUsage("block", [], true);
        expect(await storage.getItem(USAGE_KEY)).toEqual({block: {}, memo: {"nick:x": 5}});
    });
});
