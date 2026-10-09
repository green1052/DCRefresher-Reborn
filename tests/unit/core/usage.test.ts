// @vitest-environment node
import {describe, expect, it, vi} from "vitest";
import {storage} from "wxt/utils/storage";

import {recordUsage, USAGE_KEY} from "@/core/usage";

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
