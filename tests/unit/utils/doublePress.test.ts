import {describe, expect, it, vi} from "vitest";

import {createDoublePress} from "@/utils/doublePress";

describe("createDoublePress", () => {
    it("창 안에 같은 키를 다시 누르면 true이고 처음부터 센다", () => {
        vi.useFakeTimers();
        const press = createDoublePress(500);
        expect(press("d")).toBe(false);
        vi.advanceTimersByTime(499);
        expect(press("d")).toBe(true);
        expect(press("d")).toBe(false);
    });

    it("창이 지나면 다시 처음이다", () => {
        vi.useFakeTimers();
        const press = createDoublePress(500);
        press("d");
        vi.advanceTimersByTime(500);
        expect(press("d")).toBe(false);
        expect(press("d")).toBe(true);
    });

    it("다른 키는 앞 키를 무효로 한다", () => {
        vi.useFakeTimers();
        const press = createDoublePress(500);
        press("d");
        expect(press("b")).toBe(false);
        expect(press("d")).toBe(false);
    });
});
