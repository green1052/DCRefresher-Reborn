import {describe, expect, it} from "vitest";

import {createLimiter} from "@/utils/limit";

import {tick} from "../../helpers";

/** 밖에서 끝낼 수 있는 작업. */
const deferred = () => {
    let resolve!: (value: string) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<string>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
};

describe("createLimiter", () => {
    it("동시 실행 수를 넘는 작업은 앞 작업이 끝나야 시작한다", async () => {
        const limiter = createLimiter(2);
        const tasks = [deferred(), deferred(), deferred()];
        const started: number[] = [];
        const results = tasks.map((task, index) => limiter.run(() => {
            started.push(index);
            return task.promise;
        }));

        expect(started).toEqual([0, 1]);
        expect(limiter.pendingCount).toBe(1);

        tasks[0]!.resolve("a");
        await expect(results[0]).resolves.toBe("a");
        await tick();
        expect(started).toEqual([0, 1, 2]);

        tasks[1]!.resolve("b");
        tasks[2]!.resolve("c");
        await expect(Promise.all(results)).resolves.toEqual(["a", "b", "c"]);
        expect(limiter.activeCount).toBe(0);
    });

    it("늘리면 기다리던 작업이 바로 시작하고, 실패한 작업도 자리를 비운다", async () => {
        const limiter = createLimiter(1);
        const first = deferred();
        const started: string[] = [];
        const failing = limiter.run(() => {
            started.push("first");
            return first.promise;
        });
        const second = limiter.run(async () => {
            started.push("second");
            return "ok";
        });
        expect(started).toEqual(["first"]);

        limiter.setConcurrency(Number.POSITIVE_INFINITY);
        expect(started).toEqual(["first", "second"]);
        await expect(second).resolves.toBe("ok");

        first.reject(new Error("boom"));
        await expect(failing).rejects.toThrow("boom");
        await tick();
        expect(limiter.activeCount).toBe(0);
    });

    it("작업이 바로 던져도 거절된 Promise가 되고, 잘못된 동시 실행 수는 던진다", async () => {
        const limiter = createLimiter(1);
        await expect(limiter.run(() => {
            throw new Error("sync");
        })).rejects.toThrow("sync");
        expect(() => limiter.setConcurrency(0)).toThrow(TypeError);
        expect(() => limiter.setConcurrency(1.5)).toThrow(TypeError);
    });
});
