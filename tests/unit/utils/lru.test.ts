import {afterEach, describe, expect, it, vi} from "vitest";

import {LruCache} from "@/utils/lru";

describe("LruCache", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("넘치면 가장 오래 안 쓴 항목을 버린다. 읽으면 최근으로 올라간다", () => {
        const cache = new LruCache<string, number>({max: 2});
        cache.set("a", 1).set("b", 2);
        expect(cache.get("a")).toBe(1);
        cache.set("c", 3);
        expect(cache.has("b")).toBe(false);
        expect(cache.get("a")).toBe(1);
        expect(cache.get("c")).toBe(3);
        expect(cache.size).toBe(2);
    });

    it("ttl이 지나면 없는 것으로 보고, 다시 저장하면 수명이 처음부터 간다", () => {
        vi.useFakeTimers();
        const cache = new LruCache<string, number>({max: 10, ttl: 1000});
        cache.set("a", 1);
        vi.advanceTimersByTime(600);
        cache.set("a", 2);
        vi.advanceTimersByTime(600);
        expect(cache.get("a")).toBe(2);
        vi.advanceTimersByTime(500);
        expect(cache.get("a")).toBeUndefined();
        expect(cache.size).toBe(0);
    });

    it("autopurge면 만료될 때 지운다. 다시 저장한 항목은 이전 타이머가 지우지 않는다", () => {
        vi.useFakeTimers();
        const cache = new LruCache<string, number>({max: 10, ttl: 1000, autopurge: true});
        cache.set("a", 1);
        cache.set("b", 1);
        vi.advanceTimersByTime(600);
        cache.set("a", 2);
        vi.advanceTimersByTime(500);
        expect(cache.size).toBe(1);
        expect(cache.get("a")).toBe(2);
        vi.advanceTimersByTime(600);
        expect(cache.size).toBe(0);
    });

    it("memo는 없을 때만 계산하고, delete·clear로 비운다", () => {
        const cache = new LruCache<string, string>({max: 10});
        const compute = vi.fn((key: string) => key.toUpperCase());
        expect(cache.memo("a", compute)).toBe("A");
        expect(cache.memo("a", compute)).toBe("A");
        expect(compute).toHaveBeenCalledTimes(1);

        expect(cache.delete("a")).toBe(true);
        cache.memo("a", compute);
        expect(compute).toHaveBeenCalledTimes(2);
        cache.clear();
        expect(cache.size).toBe(0);
    });
});
