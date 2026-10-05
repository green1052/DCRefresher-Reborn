import {beforeEach, describe, expect, it, vi} from "vitest";

import {notify, useOptionsStore} from "@/entrypoints/options/optionsStore";

const reducedMotion = (matches: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({matches: matches && query.includes("reduce")}));

beforeEach(() => {
    useOptionsStore.setState({rain: 0, notice: null});
    return () => void vi.unstubAllGlobals();
});

describe("useOptionsStore", () => {
    it("startRain은 누를 때마다 새 값을, endRain은 0을 넣는다", () => {
        reducedMotion(false);
        vi.useFakeTimers({now: 1000});

        useOptionsStore.getState().startRain();
        expect(useOptionsStore.getState().rain).toBe(1000);
        vi.setSystemTime(2000);
        useOptionsStore.getState().startRain();
        expect(useOptionsStore.getState().rain).toBe(2000);

        useOptionsStore.getState().endRain();
        expect(useOptionsStore.getState().rain).toBe(0);
    });

    it("동작 줄이기를 켰으면 비를 내리지 않는다", () => {
        reducedMotion(true);
        useOptionsStore.getState().startRain();
        expect(useOptionsStore.getState().rain).toBe(0);
    });

    it("notify는 알림을 띄운다", () => {
        notify("저장했습니다.");
        expect(useOptionsStore.getState().notice).toBe("저장했습니다.");
    });
});
