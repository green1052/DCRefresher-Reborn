import {describe, expect, it} from "vitest";
import {storage} from "wxt/utils/storage";

import {storageSync, watchStorage} from "@/core/storage/sync";

import {tick} from "../../../helpers";

describe("storageSync", () => {
    it("키들을 한 번에 읽어 넘기고(없으면 null), 바뀌면 다시 넘기고, signal이 끝나면 감시를 푼다", async () => {
        await storage.setItem("local:a", 1);
        const seen: [string, unknown][] = [];
        const sync = storageSync(["local:a", "local:b"], (key, value) => seen.push([key, value]));
        const controller = new AbortController();

        await sync.start(controller.signal);
        expect(seen).toEqual([["local:a", 1], ["local:b", null]]);

        // 여러 번 불러도 한 번만 읽고 감시한다
        await sync.start(controller.signal);
        await storage.setItem("local:b", 2);
        await expect.poll(() => seen.length).toBe(3);
        expect(seen[2]).toEqual(["local:b", 2]);

        controller.abort();
        await storage.setItem("local:a", 3);
        await tick();
        expect(seen).toHaveLength(3);
    });
});

describe("watchStorage", () => {
    it("돌려준 함수로 먼저 풀 수 있다", async () => {
        const seen: unknown[] = [];
        const dispose = watchStorage<number>("local:c", (next) => seen.push(next));
        await storage.setItem("local:c", 1);
        await expect.poll(() => seen).toEqual([1]);

        dispose();
        await storage.setItem("local:c", 2);
        await tick();
        expect(seen).toEqual([1]);
    });
});
