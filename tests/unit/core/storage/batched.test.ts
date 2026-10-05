import {beforeEach, describe, expect, it, vi} from "vitest";

import {batchedSave} from "@/core/storage/batched";

/** 모듈 ctx 대신. dispose()가 모듈이 멈출 때다. */
const moduleContext = () => {
    const controller = new AbortController();
    const cleanups: (() => void)[] = [];
    return {
        ctx: {signal: controller.signal, addCleanup: (dispose: () => void) => void cleanups.push(dispose)},
        dispose: () => {
            controller.abort();
            for (const cleanup of cleanups) cleanup();
        }
    };
};

const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", {value: hidden, configurable: true});
    document.dispatchEvent(new Event("visibilitychange"));
};

describe("batchedSave", () => {
    beforeEach(() => void vi.useFakeTimers());

    it("delay 안의 여러 schedule을 한 번에 쓴다", () => {
        const write = vi.fn();
        const {schedule} = batchedSave(moduleContext().ctx, 1000, write);

        schedule();
        vi.advanceTimersByTime(500);
        schedule();
        vi.advanceTimersByTime(500);
        expect(write).toHaveBeenCalledTimes(1);

        schedule();
        vi.advanceTimersByTime(1000);
        expect(write).toHaveBeenCalledTimes(2);
    });

    it("flush는 바로 쓰고 잡힌 쓰기를 지운다", () => {
        const write = vi.fn();
        const {schedule, flush} = batchedSave(moduleContext().ctx, 1000, write);

        schedule();
        vi.advanceTimersByTime(500);
        // 이미 잡혀 있으면 새로 잡지 않으므로 flush가 지울 타이머는 하나다.
        schedule();
        flush();
        vi.advanceTimersByTime(1000);

        expect(write).toHaveBeenCalledTimes(1);
    });

    it("탭을 숨기거나 떠나거나 모듈이 멈추면 바로 쓴다", () => {
        const write = vi.fn();
        const {ctx, dispose} = moduleContext();
        batchedSave(ctx, 1000, write);

        setHidden(true);
        expect(write).toHaveBeenCalledTimes(1);
        setHidden(false);
        expect(write).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new Event("pagehide"));
        expect(write).toHaveBeenCalledTimes(2);

        dispose();
        expect(write).toHaveBeenCalledTimes(3);

        // 멈춘 뒤에는 페이지 이벤트를 받지 않는다.
        window.dispatchEvent(new Event("pagehide"));
        expect(write).toHaveBeenCalledTimes(3);
    });

    it("write가 던지거나 거절돼도 밖으로 던지지 않는다", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const sync = batchedSave(moduleContext().ctx, 1000, () => {
            throw new Error("sync");
        });
        const async = batchedSave(moduleContext().ctx, 1000, () => Promise.reject(new Error("async")));

        expect(() => sync.flush()).not.toThrow();
        expect(() => async.flush()).not.toThrow();
        await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(2));
    });
});
