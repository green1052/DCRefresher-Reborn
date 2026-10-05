import {afterEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {updateDatabase} from "@/core/database";
import {IP_FORMAT} from "@/core/ipdb";
import {startDatabaseUpdates} from "@/entrypoints/background/database";

import {tick} from "../../../helpers";

vi.mock("@/core/database", () => ({updateDatabase: vi.fn(async () => {})}));

afterEach(() => void vi.unstubAllEnvs());

const ALARM = "refresher:dbCheck";
const DAY = 24 * 60;
const WEEK = 604_800_000;

const settle = async () => {
    for (let index = 0; index < 5; index++) await tick();
};
const ring = async (name = ALARM) => {
    await fakeBrowser.alarms.onAlarm.trigger({name, scheduledTime: Date.now(), persistAcrossSessions: false});
    await settle();
};
const setMeta = (lastUpdate: number, format: number | undefined = IP_FORMAT) =>
    fakeBrowser.storage.local.set({"refresher:db:meta": {version: "1", lastUpdate, format}});

describe("startDatabaseUpdates", () => {
    it("배포 빌드는 하루 주기 알람이 없거나 주기가 다르면 만든다", async () => {
        vi.stubEnv("PROD", true);
        await fakeBrowser.alarms.create(ALARM, {periodInMinutes: 60});

        startDatabaseUpdates();
        await settle();

        expect(await fakeBrowser.alarms.get(ALARM)).toMatchObject({periodInMinutes: DAY});
    });

    it("주기가 같은 알람은 다시 만들지 않는다", async () => {
        vi.stubEnv("PROD", true);
        await fakeBrowser.alarms.create(ALARM, {periodInMinutes: DAY});
        const create = vi.spyOn(fakeBrowser.alarms, "create");

        startDatabaseUpdates();
        await settle();

        expect(create).not.toHaveBeenCalled();
    });

    it("개발 빌드는 알람을 만들지 않는다", async () => {
        vi.stubEnv("PROD", false);
        startDatabaseUpdates();
        await settle();
        expect(await fakeBrowser.alarms.getAll()).toEqual([]);
    });

    it("7일이 지났거나 형식이 옛것이면 받는다", async () => {
        startDatabaseUpdates();

        await setMeta(Date.now() - WEEK - 1000);
        await ring();
        expect(updateDatabase).toHaveBeenCalledTimes(1);

        await setMeta(Date.now(), IP_FORMAT - 1);
        await ring();
        expect(updateDatabase).toHaveBeenCalledTimes(2);
    });

    it("받은 지 7일이 안 됐거나 다른 알람이면 받지 않는다", async () => {
        startDatabaseUpdates();

        await setMeta(Date.now() - WEEK + 60_000);
        await ring();
        await setMeta(0);
        await ring("other");

        expect(updateDatabase).not.toHaveBeenCalled();
    });

    it("진행 중인 갱신은 같이 기다리고, 끝나면 다시 받을 수 있다", async () => {
        const gate = Promise.withResolvers<void>();
        vi.mocked(updateDatabase).mockReturnValueOnce(gate.promise);
        const update = startDatabaseUpdates();

        const first = update();
        const second = update();
        expect(updateDatabase).toHaveBeenCalledTimes(1);

        gate.resolve();
        await Promise.all([first, second]);
        await update();
        expect(updateDatabase).toHaveBeenCalledTimes(2);
    });

    it("실패해도 던지지 않고 다음에 다시 받는다", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.mocked(updateDatabase).mockRejectedValueOnce(new Error("net"));
        const update = startDatabaseUpdates();

        await expect(update()).resolves.toBeUndefined();
        await update();

        expect(error).toHaveBeenCalled();
        expect(updateDatabase).toHaveBeenCalledTimes(2);
    });
});
