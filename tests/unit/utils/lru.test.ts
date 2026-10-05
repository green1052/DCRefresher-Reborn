import {describe, expect, it, vi} from "vitest";

import {LruCache} from "@/utils/lru";

describe("LruCache", () => {
    it("넘치면 가장 오래 안 쓴 것을 버린다", () => {
        const cache = new LruCache<string, number>({max: 2});
        cache.set("a", 1).set("b", 2);
        // 읽은 a는 맨 뒤로 가서 b가 밀려난다.
        expect(cache.get("a")).toBe(1);
        cache.set("c", 3);
        expect(cache.has("b")).toBe(false);
        expect(cache.get("a")).toBe(1);
        expect(cache.get("c")).toBe(3);
        expect(cache.size).toBe(2);
    });

    it("같은 키는 하나로 센다", () => {
        const cache = new LruCache<string, number>({max: 2});
        cache.set("a", 1).set("a", 2).set("b", 3);
        expect(cache.size).toBe(2);
        expect(cache.get("a")).toBe(2);
    });

    it("ttl이 지나면 없는 것으로 보고, 다시 저장하면 수명이 처음부터 간다", () => {
        vi.useFakeTimers();
        const cache = new LruCache<string, number>({max: 10, ttl: 1000});
        cache.set("a", 1);
        vi.advanceTimersByTime(600);
        cache.set("a", 2);
        vi.advanceTimersByTime(600);
        expect(cache.get("a")).toBe(2);
        vi.advanceTimersByTime(400);
        expect(cache.get("a")).toBeUndefined();
        expect(cache.size).toBe(0);
    });

    it("autopurge면 만료될 때 지운다", () => {
        vi.useFakeTimers();
        const cache = new LruCache<string, number>({max: 10, ttl: 1000, autopurge: true});
        cache.set("a", 1);
        vi.advanceTimersByTime(1000);
        expect(cache.size).toBe(0);
    });

    it("autopurge가 아니면 읽기 전까지 남는다", () => {
        vi.useFakeTimers();
        const cache = new LruCache<string, number>({max: 10, ttl: 1000});
        cache.set("a", 1);
        vi.advanceTimersByTime(2000);
        expect(cache.size).toBe(1);
    });

    it("다시 저장한 값은 옛 타이머에 지워지지 않는다", () => {
        vi.useFakeTimers();
        const cache = new LruCache<string, number>({max: 10, ttl: 1000, autopurge: true});
        cache.set("a", 1);
        vi.advanceTimersByTime(800);
        cache.set("a", 2);
        vi.advanceTimersByTime(800);
        expect(cache.get("a")).toBe(2);
    });

    it("delete·clear는 값과 타이머를 지운다", () => {
        vi.useFakeTimers();
        const cache = new LruCache<string, number>({max: 10, ttl: 1000, autopurge: true});
        cache.set("a", 1).set("b", 2);
        expect(cache.delete("a")).toBe(true);
        expect(cache.delete("a")).toBe(false);
        cache.clear();
        expect(cache.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("memo는 없을 때만 계산한다", () => {
        const cache = new LruCache<string, number>({max: 10});
        const compute = vi.fn((key: string) => key.length);
        expect(cache.memo("abc", compute)).toBe(3);
        expect(cache.memo("abc", compute)).toBe(3);
        expect(compute).toHaveBeenCalledTimes(1);
    });
});
