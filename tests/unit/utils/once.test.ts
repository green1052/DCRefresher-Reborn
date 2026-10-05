import {describe, expect, it, vi} from "vitest";

import {once} from "@/utils/once";

describe("once", () => {
    it("동시 호출은 같은 Promise를 기다리고 첫 호출의 인자만 쓴다", async () => {
        const run = vi.fn(async (value: number) => value * 2);
        const init = once(run);
        const [a, b] = [init(1), init(5)];
        expect(a).toBe(b);
        expect(await a).toBe(2);
        expect(await init(9)).toBe(2);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("실패하면 다음 호출이 다시 시도한다", async () => {
        const run = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error("실패")).mockResolvedValue("성공");
        const init = once(run);
        await expect(init()).rejects.toThrow("실패");
        expect(await init()).toBe("성공");
        expect(run).toHaveBeenCalledTimes(2);
    });
});
