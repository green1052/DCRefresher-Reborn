import {afterEach, describe, expect, it, vi} from "vitest";
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

        // 여러 번 불러도 한 번만 읽고 감시한다.
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

describe("storageSync 읽는 사이의 변경", () => {
    afterEach(() => vi.restoreAllMocks());

    it("읽는 사이 다른 탭이 쓴 값을 읽은 옛 값으로 덮지 않는다", async () => {
        await storage.setItem("local:list", ["old"]);
        const getItems = storage.getItems.bind(storage);
        // 옛 값을 읽어 둔 뒤, 돌려주기 전에 다른 탭이 새 값을 쓴다.
        vi.spyOn(storage, "getItems").mockImplementationOnce(async (keys) => {
            const snapshot = await getItems(keys);
            await storage.setItem("local:list", ["old", "new"]);
            await tick();
            return snapshot;
        });
        let value: unknown;
        await storageSync(["local:list"], (_key, next) => (value = next)).start();

        expect(value).toEqual(["old", "new"]);
    });

    it("읽기가 실패하면 감시를 풀어, 다시 시작해도 변경을 한 번만 받는다", async () => {
        vi.spyOn(storage, "getItems").mockRejectedValueOnce(new Error("read"));
        const seen: unknown[] = [];
        const sync = storageSync(["local:retry"], (_key, next) => seen.push(next));
        await expect(sync.start()).rejects.toThrow("read");

        await sync.start();
        seen.length = 0;
        await storage.setItem("local:retry", 1);
        await expect.poll(() => seen).toEqual([1]);
        await tick();
        expect(seen).toEqual([1]);
    });
});

describe("watchStorage", () => {
    it("이미 끝난 signal이면 감시를 걸지 않는다", async () => {
        const controller = new AbortController();
        controller.abort();
        const seen: unknown[] = [];
        watchStorage<number>("local:d", (next) => seen.push(next), controller.signal);
        await storage.setItem("local:d", 1);
        await tick();
        expect(seen).toEqual([]);
    });

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
