// @vitest-environment node
// jsdom의 Blob에는 stream()이 없어 압축을 못 한다. 이 모듈은 DOM을 쓰지 않는다.
import {beforeEach, describe, expect, it, vi} from "vitest";

import {collectLocalData, isBackupTarget, readBackupTargets, readCloudBackup, readCloudBackupStatus, runBackup} from "@/core/backup";

import {stored} from "../../helpers";

const ERROR = "refresher:backup:error";

/** 압축되지 않는 글자. 조각 수를 늘릴 때 쓴다. */
const noise = (length: number): string => Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => String.fromCharCode(0xac00 + byte)).join("");

const syncKeys = async (): Promise<string[]> => Object.keys(await browser.storage.sync.get(null)).sort();

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("isBackupTarget", () => {
    it("설정·차단·메모만 대상이다", () => {
        const targets = ["refresher:modules", "refresher:block:defaults", "refresher:block:NICK", "refresher:block:TAB", "refresher:memo:UID", "refresher:module:preview:settings"];
        const others = ["refresher:db:ip", "refresher:db:meta", "refresher:module:userinfo:data", "refresher:backup:auto", "refresher:usage", "refresher:block:UNKNOWN", "refresher:memo:X", "other"];
        expect(targets.filter(isBackupTarget)).toEqual(targets);
        expect(others.filter(isBackupTarget)).toEqual([]);
    });
});

describe("readBackupTargets / collectLocalData", () => {
    it("대상 키만 읽고 차단 항목의 id를 뺀다", async () => {
        await browser.storage.local.set({
            "refresher:modules": {preview: true},
            "refresher:block:NICK": [{id: "uuid", content: "닉", isRegex: false}, "깨진 항목"],
            "refresher:memo:UID": {a: {text: "메모", color: "red"}},
            "refresher:db:ip": "큰 값"
        });
        expect(Object.keys(await readBackupTargets()).sort()).toEqual(["refresher:block:NICK", "refresher:memo:UID", "refresher:modules"]);

        const data = await collectLocalData();
        expect(JSON.parse(JSON.stringify(data))).toEqual({
            "refresher:modules": {preview: true},
            "refresher:block:NICK": [{content: "닉", isRegex: false}, "깨진 항목"],
            "refresher:memo:UID": {a: {text: "메모", color: "red"}}
        });
    });

    it("대상이 없으면 빈 객체다", async () => {
        await browser.storage.local.set({"refresher:db:ip": "x"});
        expect(await readBackupTargets()).toEqual({});
    });
});

describe("runBackup / readCloudBackup", () => {
    it("올린 설정을 그대로 읽어 오고 수동·자동 칸은 따로다", async () => {
        vi.spyOn(Date, "now").mockReturnValue(1234);
        await browser.storage.local.set({"refresher:modules": {a: true}});
        await runBackup("manual");
        await browser.storage.local.set({"refresher:modules": {a: false}});
        await runBackup("auto");

        expect(await readCloudBackup("manual")).toEqual({data: {"refresher:modules": {a: true}}, createdAt: 1234});
        expect(await readCloudBackup("auto")).toEqual({data: {"refresher:modules": {a: false}}, createdAt: 1234});
        expect(await syncKeys()).toEqual(["autoBackup", "autoBackup:0", "backup", "backup:0"]);
    });

    it("백업이 없으면 null이다", async () => {
        expect(await readCloudBackup("manual")).toBeNull();
    });

    it("큰 설정은 8KB 이하 조각으로 나누고 줄어들면 남는 조각을 지운다", async () => {
        await browser.storage.local.set({"refresher:modules": {big: noise(6000)}});
        await runBackup("manual");
        await browser.storage.local.set({"refresher:modules": {small: true}});
        await runBackup("auto");

        const all = await browser.storage.sync.get(null);
        const chunks = Object.keys(all).filter((key) => key.startsWith("backup:"));
        expect(chunks.length).toBeGreaterThan(1);
        for (const key of chunks) expect(String(all[key]).length).toBeLessThanOrEqual(8000);

        await browser.storage.local.set({"refresher:modules": {small: true}});
        await runBackup("manual");
        // 다른 칸(auto)의 조각은 그대로다.
        expect(await syncKeys()).toEqual(["autoBackup", "autoBackup:0", "backup", "backup:0"]);
        expect((await readCloudBackup("manual"))?.data).toEqual({"refresher:modules": {small: true}});
    });

    it("조각이 빠지면 던진다", async () => {
        await browser.storage.local.set({"refresher:modules": {big: noise(6000)}});
        await runBackup("manual");
        await browser.storage.sync.remove("backup:1");
        await expect(readCloudBackup("manual")).rejects.toThrow("백업 조각이 빠져 있습니다");
    });

    it("조각이 메타와 맞지 않으면 던진다", async () => {
        await browser.storage.local.set({"refresher:modules": {a: true}});
        await runBackup("manual");
        // 다른 기기의 새 메타만 먼저 온 경우처럼 조각이 다른 백업의 것이다.
        await browser.storage.local.set({"refresher:modules": {a: false}});
        await runBackup("auto");
        await browser.storage.sync.set({"backup:0": (await browser.storage.sync.get("autoBackup:0"))["autoBackup:0"]});
        await expect(readCloudBackup("manual")).rejects.toThrow("백업 데이터가 맞지 않습니다");
    });

    it("성공하면 남은 실패 이유를 지운다", async () => {
        await browser.storage.local.set({[ERROR]: "이전 실패"});
        await runBackup("manual");
        expect(await stored(ERROR)).toBe("");
    });

    it("쓰다 실패하면 이전 백업을 그대로 두고 이유를 남긴다", async () => {
        await browser.storage.local.set({"refresher:modules": {a: true}});
        await runBackup("manual");
        await browser.storage.local.set({"refresher:modules": {a: false}});
        vi.spyOn(browser.storage.sync, "set").mockRejectedValueOnce(new Error("MAX_WRITE_OPERATIONS_PER_MINUTE"));

        await expect(runBackup("manual")).rejects.toThrow("MAX_WRITE_OPERATIONS");
        expect(await stored(ERROR)).toBe("짧은 시간에 너무 자주 저장했습니다. 잠시 후 다시 시도해 주세요.");
        expect((await readCloudBackup("manual"))?.data).toEqual({"refresher:modules": {a: true}});
    });

    it("두 칸을 합쳐 한도를 넘으면 쓰지 않고 크기를 알린다", async () => {
        await browser.storage.local.set({"refresher:modules": {big: noise(40_000)}});
        await runBackup("manual");
        const before = await browser.storage.sync.get(null);

        await expect(runBackup("auto")).rejects.toThrow(/클라우드 한도를 넘습니다.*KB \+ 다른 백업 \d+KB \/ 97KB/);
        expect(await browser.storage.sync.get(null)).toEqual(before);
        expect(await stored(ERROR)).toMatch(/클라우드 한도/);
    });
});

describe("readCloudBackupStatus", () => {
    it("칸마다 시각·크기와 전체 사용량을 알린다", async () => {
        vi.spyOn(Date, "now").mockReturnValue(77);
        vi.spyOn(browser.storage.sync, "getBytesInUse").mockImplementation(async () => 4096);
        await browser.storage.local.set({"refresher:modules": {a: true}});
        await runBackup("auto");

        const status = await readCloudBackupStatus();
        const meta = (await browser.storage.sync.get("autoBackup")).autoBackup;
        expect(status).toEqual({manual: undefined, auto: {createdAt: 77, size: expect.any(Number)}, used: 4096});
        expect(meta).toMatchObject({size: status.auto?.size, chunks: 1});
    });
});
