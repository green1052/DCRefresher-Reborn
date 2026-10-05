import {describe, expect, it, vi} from "vitest";

import {createDoublePress} from "@/utils/doublePress";

describe("createDoublePress", () => {
    it("창 안에 같은 키를 다시 누르면 확인이고, 다른 키·창 밖이면 다시 첫 번째다", () => {
        vi.useFakeTimers({now: 10_000});
        const press = createDoublePress(1000);

        expect(press("d")).toBe(false);
        vi.advanceTimersByTime(999);
        expect(press("d")).toBe(true);

        // 확인 뒤에는 바로 다시 눌러도 첫 번째다.
        expect(press("d")).toBe(false);

        // 다른 키를 거치면 이전 것은 무효다.
        expect(press("b")).toBe(false);
        vi.advanceTimersByTime(500);
        expect(press("d")).toBe(false);
        vi.advanceTimersByTime(500);
        expect(press("d")).toBe(true);

        // 창을 넘기면 다시 첫 번째다.
        vi.advanceTimersByTime(1001);
        expect(press("d")).toBe(false);
    });
});
