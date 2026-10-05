import {describe, expect, it} from "vitest";

import {createLimiter} from "@/utils/limit";

import {tick} from "../../helpers";

/** 끝낼 때까지 걸려 있는 작업. */
const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => (resolve = done));
    return {promise, resolve};
};

describe("createLimiter", () => {
    it("동시 실행 수만큼만 돌리고 나머지는 차례로 기다린다", async () => {
        const limiter = createLimiter(2);
        const tasks = [deferred(), deferred(), deferred()];
        const started: number[] = [];
        const runs = tasks.map((task, index) => limiter.run(async () => {
            started.push(index);
            await task.promise;
            return index;
        }));

        expect(started).toEqual([0, 1]);
        expect(limiter.activeCount).toBe(2);
        expect(limiter.pendingCount).toBe(1);

        tasks[0]!.resolve();
        await tick();
        expect(started).toEqual([0, 1, 2]);

        tasks[1]!.resolve();
        tasks[2]!.resolve();
        expect(await Promise.all(runs)).toEqual([0, 1, 2]);
        expect(limiter.activeCount).toBe(0);
    });

    it("늘리면 기다리던 작업이 바로 시작한다", () => {
        const limiter = createLimiter(1);
        const gate = deferred();
        let started = 0;
        for (let index = 0; index < 3; index++) {
            void limiter.run(async () => {
                started++;
                await gate.promise;
            });
        }
        expect(started).toBe(1);

        limiter.setConcurrency(3);
        expect(started).toBe(3);
        expect(limiter.pendingCount).toBe(0);
        gate.resolve();
    });

    it("줄이면 도는 작업이 끝날 때부터 따른다", async () => {
        const limiter = createLimiter(2);
        const tasks = [deferred(), deferred(), deferred(), deferred()];
        let started = 0;
        for (const task of tasks) {
            void limiter.run(async () => {
                started++;
                await task.promise;
            });
        }
        limiter.setConcurrency(1);
        expect(limiter.activeCount).toBe(2);

        tasks[0]!.resolve();
        await tick();
        // 아직 하나가 돌고 있어 새로 시작하지 않는다.
        expect(started).toBe(2);

        tasks[1]!.resolve();
        await tick();
        expect(started).toBe(3);
        tasks[2]!.resolve();
        tasks[3]!.resolve();
    });

    it("바로 던지는 작업도 거절된 Promise가 되고 자리를 비운다", async () => {
        const limiter = createLimiter(1);
        await expect(limiter.run(() => {
            throw new Error("실패");
        })).rejects.toThrow("실패");
        expect(limiter.activeCount).toBe(0);
        expect(await limiter.run(async () => "다음")).toBe("다음");
    });

    it("1 이상의 정수나 Infinity만 받는다", () => {
        const limiter = createLimiter(1);
        for (const value of [0, -1, 1.5, Number.NaN]) expect(() => limiter.setConcurrency(value)).toThrow(TypeError);
        expect(() => limiter.setConcurrency(Number.POSITIVE_INFINITY)).not.toThrow();
    });
});
