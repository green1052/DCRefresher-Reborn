import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {batchedSave} from "@/core/storage/batched";

let controller: AbortController;
let cleanups: (() => void)[];
const ctx = () => ({signal: controller.signal, addCleanup: (dispose: () => void) => cleanups.push(dispose)});

beforeEach(() => {
    controller = new AbortController();
    cleanups = [];
    vi.useFakeTimers();
});

afterEach(() => {
    controller.abort();
});

describe("batchedSave", () => {
    it("여러 번 예약해도 delay 뒤에 한 번만 쓴다", () => {
        const write = vi.fn();
        const saver = batchedSave(ctx(), 1000, write);
        saver.schedule();
        vi.advanceTimersByTime(500);
        saver.schedule();
        vi.advanceTimersByTime(500);
        expect(write).toHaveBeenCalledOnce();
    });

    it("페이지를 떠나거나 모듈이 멈추면 바로 쓰고, 잡아 둔 예약은 지운다", () => {
        const write = vi.fn();
        const saver = batchedSave(ctx(), 1000, write);
        saver.schedule();
        window.dispatchEvent(new Event("pagehide"));
        expect(write).toHaveBeenCalledOnce();
        vi.advanceTimersByTime(1000);
        expect(write).toHaveBeenCalledOnce();

        for (const cleanup of cleanups) cleanup();
        expect(write).toHaveBeenCalledTimes(2);
    });

    it("쓰다 실패해도 던지지 않는다", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const saver = batchedSave(ctx(), 1000, () => Promise.reject(new Error("quota")));
        saver.flush();
        await vi.waitFor(() => expect(error).toHaveBeenCalled());
    });
});
