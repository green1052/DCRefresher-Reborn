import {describe, expect, it, vi} from "vitest";

import {updateDatabase} from "@/core/database";
import {startDatabaseUpdates} from "@/entrypoints/background/database";

import {tick} from "../../../helpers";

vi.mock("@/core/database", () => ({updateDatabase: vi.fn()}));

/** 부를 때마다 끝내지 않은 갱신을 하나 만든다. 끝내는 함수는 부른 순서대로 쌓인다. */
const deferUpdates = () => {
    const pending = new Array<{ resolve: () => void; reject: (e: Error) => void }>();
    vi.mocked(updateDatabase).mockImplementation(() => new Promise((resolve, reject) => pending.push({resolve: () => resolve(), reject})));
    return pending;
};

describe("startDatabaseUpdates", () => {
    it("진행 중인 갱신이 있으면 같이 기다리고 다시 받지 않는다", async () => {
        const pending = deferUpdates();
        const update = startDatabaseUpdates();

        const first = update();
        const second = update();
        await tick();
        expect(updateDatabase).toHaveBeenCalledTimes(1);

        pending[0]?.resolve();
        await Promise.all([first, second]);
        expect(updateDatabase).toHaveBeenCalledTimes(1);
    });

    it("force는 진행 중인 갱신이 끝난 뒤 새로 받고, 그동안 온 갱신은 force를 같이 기다린다", async () => {
        const pending = deferUpdates();
        const update = startDatabaseUpdates();

        void update();
        const forced = update(true);
        await tick();
        expect(updateDatabase).toHaveBeenCalledTimes(1);

        pending[0]?.resolve();
        await tick();
        expect(updateDatabase).toHaveBeenCalledTimes(2);
        expect(updateDatabase).toHaveBeenLastCalledWith(true);

        const joined = update();
        pending[1]?.resolve();
        await Promise.all([forced, joined]);
        expect(updateDatabase).toHaveBeenCalledTimes(2);
    });

    it("force는 실패를 던지고, 그 밖의 갱신은 로그만 남긴다", async () => {
        const pending = deferUpdates();
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const update = startDatabaseUpdates();

        const forced = update(true);
        const joined = update();
        await tick();
        pending[0]?.reject(new Error("실패"));

        await expect(forced).rejects.toThrow("실패");
        await expect(joined).resolves.toBeUndefined();
        expect(error).toHaveBeenCalled();

        // 실패한 갱신을 붙들고 있지 않는다.
        void update();
        await tick();
        expect(updateDatabase).toHaveBeenCalledTimes(2);
    });
});
