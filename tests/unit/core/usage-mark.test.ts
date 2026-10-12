import {beforeEach, describe, expect, it, vi} from "vitest";

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
        vi.advanceTimersByTime(1000);
        markUsed("block", "a");
        markUsed("memo", "a");
        vi.advanceTimersByTime(5000);

        expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:markUsed", {block: {a: START}, memo: {a: START + 1000}});
    });

    it("5초 동안 모았다가 한 번에 보낸다", async () => {
        const markUsed = await load();
        markUsed("block", "a");
        vi.advanceTimersByTime(4000);
        markUsed("block", "b");
        vi.advanceTimersByTime(999);
        expect(sendMessage).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:markUsed", {block: {a: START, b: START + 4000}, memo: {}});
        vi.advanceTimersByTime(60_000);
        expect(sendMessage).toHaveBeenCalledOnce();
    });

    it("보낸 뒤에 적은 항목은 새 묶음으로 보낸다", async () => {
        const markUsed = await load();
        markUsed("block", "a");
        vi.advanceTimersByTime(5000);
        markUsed("block", "b");
        vi.advanceTimersByTime(5000);

        expect(sendMessage).toHaveBeenCalledTimes(2);
        expect(sendMessage).toHaveBeenLastCalledWith("refresher:markUsed", {block: {b: START + 5000}, memo: {}});
    });

    it("페이지를 떠나면 기다리지 않고 보낸다", async () => {
        const markUsed = await load();
        markUsed("memo", "nick:x");
        window.dispatchEvent(new Event("pagehide"));
        expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:markUsed", {block: {}, memo: {"nick:x": START}});

        vi.advanceTimersByTime(5000);
        expect(sendMessage).toHaveBeenCalledOnce();
    });
});
