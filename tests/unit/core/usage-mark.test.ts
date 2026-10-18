import {storage} from "wxt/utils/storage";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {USAGE_KEY} from "@/core/storage/items";

const sendMessage = vi.hoisted(() => vi.fn());
vi.mock("@/core/messaging/protocol", () => ({sendMessage}));

const HOUR = 60 * 60 * 1000;
const START = 100 * HOUR;

/** 모듈 상태(보낸 기록·모으는 묶음·타이머)를 테스트마다 새로 시작한다. */
const load = async (): Promise<typeof import("@/core/usage")["markUsed"]> => {
    vi.resetModules();
    return (await import("@/core/usage")).markUsed;
};

beforeEach(() => {
    vi.useFakeTimers({now: START});
    sendMessage.mockResolvedValue(undefined);
});

describe("markUsed", () => {
    it("한 시간 안에 같은 항목을 또 적으면 한 번만 보낸다", async () => {
        const markUsed = await load();
        markUsed("block", "a");
        await vi.advanceTimersByTimeAsync(1000);
        markUsed("block", "a");
        markUsed("memo", "a");
        await vi.advanceTimersByTimeAsync(5000);

        expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:markUsed", {block: {a: START}, memo: {a: START + 1000}});
    });

    it("5초 동안 모았다가 한 번에 보낸다", async () => {
        const markUsed = await load();
        markUsed("block", "a");
        await vi.advanceTimersByTimeAsync(4000);
        markUsed("block", "b");
        await vi.advanceTimersByTimeAsync(999);
        expect(sendMessage).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:markUsed", {block: {a: START, b: START + 4000}, memo: {}});
        await vi.advanceTimersByTimeAsync(60_000);
        expect(sendMessage).toHaveBeenCalledOnce();
    });

    it("보낸 뒤에 적은 항목은 새 묶음으로 보낸다", async () => {
        const markUsed = await load();
        markUsed("block", "a");
        await vi.advanceTimersByTimeAsync(5000);
        markUsed("block", "b");
        await vi.advanceTimersByTimeAsync(5000);

        expect(sendMessage).toHaveBeenCalledTimes(2);
        expect(sendMessage).toHaveBeenLastCalledWith("refresher:markUsed", {block: {b: START + 5000}, memo: {}});
    });

    it("페이지를 떠나면 기다리지 않고 보낸다", async () => {
        const markUsed = await load();
        markUsed("memo", "nick:x");
        window.dispatchEvent(new Event("pagehide"));
        await vi.advanceTimersByTimeAsync(0);
        expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:markUsed", {block: {}, memo: {"nick:x": START}});

        await vi.advanceTimersByTimeAsync(5000);
        expect(sendMessage).toHaveBeenCalledOnce();
    });

    it("저장된 지 한 시간이 안 된 항목은 보내지 않고, 저장소를 한 번만 읽는다", async () => {
        await storage.setItem(USAGE_KEY, {block: {a: START - HOUR / 2, b: START - 2 * HOUR}, memo: {}});
        const getItem = vi.spyOn(storage, "getItem");
        const markUsed = await load();
        markUsed("block", "a");
        markUsed("block", "b");
        await vi.advanceTimersByTimeAsync(5000);
        expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:markUsed", {block: {b: START}, memo: {}});

        // 읽은 기록으로 채웠으니 a는 저장된 때부터 한 시간이 지나야 다시 보낸다.
        await vi.advanceTimersByTimeAsync(HOUR / 2 - 5000 - 1);
        markUsed("block", "a");
        await vi.advanceTimersByTimeAsync(1);
        markUsed("block", "a");
        await vi.advanceTimersByTimeAsync(5000);
        expect(sendMessage).toHaveBeenLastCalledWith("refresher:markUsed", {block: {a: START + HOUR / 2}, memo: {}});
        expect(getItem).toHaveBeenCalledOnce();
    });
});
