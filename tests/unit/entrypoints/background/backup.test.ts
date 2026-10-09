// @vitest-environment node
import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {runBackup} from "@/core/backup";
import {startAutoBackup} from "@/entrypoints/background/backup";

import {stored, tick} from "../../../helpers";

vi.mock("@/core/backup", async (importOriginal) => ({...await importOriginal<typeof import("@/core/backup")>(), runBackup: vi.fn()}));

const ALARM = "refresher:autoBackup";
const settle = async () => {
    for (let index = 0; index < 5; index++) await tick();
};
const ring = async (name = ALARM) => {
    await fakeBrowser.alarms.onAlarm.trigger({name, scheduledTime: Date.now(), persistAcrossSessions: false});
    await settle();
};

describe("startAutoBackup", () => {
    it("자동 백업이 켜져 있으면 백업 대상이 바뀔 때 알람을 걸고 대기를 적는다", async () => {
        await fakeBrowser.storage.local.set({"refresher:backup:auto": true});
        startAutoBackup();

        await fakeBrowser.storage.local.set({"refresher:block:NICK": []});
        await settle();

        expect(await fakeBrowser.alarms.get(ALARM)).toMatchObject({name: ALARM});
        expect(await stored("refresher:backup:pending")).toBe(true);
    });

    it("백업 대상이 아니거나 자동 백업이 꺼져 있으면 걸지 않는다", async () => {
        startAutoBackup();
        await fakeBrowser.storage.local.set({"refresher:block:NICK": []});
        await settle();
        expect(await fakeBrowser.alarms.get(ALARM)).toBeUndefined();

        await fakeBrowser.storage.local.set({"refresher:backup:auto": true});
        await fakeBrowser.storage.local.set({"refresher:db:meta": {}, "refresher:module:a:data": 1});
        await settle();
        expect(await fakeBrowser.alarms.get(ALARM)).toBeUndefined();
    });

    it("시작할 때 대기가 남았는데 알람이 없으면 다시 건다", async () => {
        await fakeBrowser.storage.local.set({"refresher:backup:pending": true});
        startAutoBackup();

        await fakeBrowser.runtime.onStartup.trigger();
        await settle();

        expect(await fakeBrowser.alarms.get(ALARM)).toMatchObject({name: ALARM});
    });

    it("알람이 이미 있거나 대기가 없으면 다시 걸지 않는다", async () => {
        startAutoBackup();
        const create = vi.spyOn(fakeBrowser.alarms, "create");

        await fakeBrowser.runtime.onInstalled.trigger({reason: "update", previousVersion: "1"});
        await settle();
        expect(create).not.toHaveBeenCalled();

        await fakeBrowser.alarms.create(ALARM, {delayInMinutes: 1});
        await fakeBrowser.storage.local.set({"refresher:backup:pending": true});
        create.mockClear();
        await fakeBrowser.runtime.onStartup.trigger();
        await settle();
        expect(create).not.toHaveBeenCalled();
    });

    it("알람이 울리면 백업하고 대기를 지운다", async () => {
        await fakeBrowser.storage.local.set({"refresher:backup:auto": true, "refresher:backup:pending": true});
        startAutoBackup();

        await ring();

        expect(runBackup).toHaveBeenCalledWith("auto");
        expect(await stored("refresher:backup:pending")).toBe(false);
    });

    it("그사이 새 알람이 걸렸으면 대기를 남긴다", async () => {
        await fakeBrowser.storage.local.set({"refresher:backup:auto": true, "refresher:backup:pending": true});
        vi.mocked(runBackup).mockImplementation(async () => void await fakeBrowser.alarms.create(ALARM, {delayInMinutes: 1}));
        startAutoBackup();

        await ring();

        expect(await stored("refresher:backup:pending")).toBe(true);
    });

    it("백업이 실패하면 대기를 남긴다", async () => {
        await fakeBrowser.storage.local.set({"refresher:backup:auto": true, "refresher:backup:pending": true});
        vi.mocked(runBackup).mockRejectedValue(new Error("offline"));
        startAutoBackup();

        await ring();

        expect(await stored("refresher:backup:pending")).toBe(true);
    });

    it("자동 백업을 끈 뒤 울린 알람은 백업하지 않는다", async () => {
        await fakeBrowser.storage.local.set({"refresher:backup:pending": true});
        startAutoBackup();

        await ring();
        await ring("other");

        expect(runBackup).not.toHaveBeenCalled();
        expect(await stored("refresher:backup:pending")).toBe(false);
    });
});
