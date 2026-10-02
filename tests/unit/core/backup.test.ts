// @vitest-environment node
// jsdom의 Blob에는 stream()이 없어 gzip을 못 한다. 이 모듈은 DOM을 쓰지 않는다.
import {beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {collectLocalData, isBackupTarget, readCloudBackup, readCloudBackupStatus, runBackup} from "@/core/backup";

import {stored} from "../../helpers";

const local = {
    "refresher:modules": {block: true},
    "refresher:module:preview:settings": {previewWidth: 900},
    "refresher:block:NICK": [{id: "uuid-1", content: "n", isRegex: false}],
    "refresher:memo:UID": {u: {text: "m", color: "#fff"}},
    "refresher:db:ip": "x".repeat(1000),
    "refresher:db:meta": {version: "1", lastUpdate: 1},
    "refresher:backup:auto": true,
    "refresher:module:userinfo:data": {ratio: {}}
};

// fake-browser에는 getBytesInUse가 없다 (실제 브라우저가 한도에 쓰는 값이라 여기서는 0으로 둔다).
beforeEach(() => {
    vi.spyOn(fakeBrowser.storage.sync, "getBytesInUse").mockResolvedValue(0 as never);
});

describe("isBackupTarget / collectLocalData", () => {
    it("설정·차단·메모만 담고 차단 항목의 id를 뺀다", async () => {
        await fakeBrowser.storage.local.set(local);
        const data = await collectLocalData();
        expect(Object.keys(data).sort()).toEqual(["refresher:block:NICK", "refresher:memo:UID", "refresher:module:preview:settings", "refresher:modules"]);
        expect(JSON.stringify(data["refresher:block:NICK"])).toBe("[{\"content\":\"n\",\"isRegex\":false}]");
        expect(isBackupTarget("refresher:block:defaults")).toBe(true);
        // 모르는 키(예전 버전이 남긴 옛 DB 등)는 클라우드 한도를 넘길 수 있어 담지 않는다.
        for (const key of ["refresher:db", "refresher.database.ip", "refresher:settings", "refresher:usage"]) expect(isBackupTarget(key), key).toBe(false);
    });
});

describe("runBackup / readCloudBackup", () => {
    it("압축해 조각으로 올리고 그대로 읽어 온다. 수동·자동 칸은 따로다", async () => {
        await fakeBrowser.storage.local.set(local);
        await runBackup("manual");

        const sync = await fakeBrowser.storage.sync.get(null);
        expect(sync.backup).toMatchObject({format: 1, chunks: 1});
        expect(typeof sync["backup:0"]).toBe("string");
        expect(await stored("refresher:backup:error")).toBe("");

        const status = await readCloudBackupStatus();
        expect(status.manual?.createdAt).toBe((sync.backup as { createdAt: number }).createdAt);
        expect(status.auto).toBeUndefined();

        const backup = await readCloudBackup("manual");
        expect(backup?.data).toEqual(await collectLocalData());
        expect(await readCloudBackup("auto")).toBeNull();
    });

    it("큰 설정은 8KB 조각 여러 개로 나뉘고, 줄어들면 남는 조각을 지운다", async () => {
        // 무작위 문자열은 압축이 안 돼 조각이 여럿 나온다.
        const big = Array.from({length: 40}, () => Array.from(crypto.getRandomValues(new Uint8Array(400)), (byte) => byte.toString(16).padStart(2, "0")).join(""));
        await fakeBrowser.storage.local.set({"refresher:memo:NICK": Object.fromEntries(big.map((text, index) => [index, {text, color: "#000"}]))});
        await runBackup("auto");
        const first = await fakeBrowser.storage.sync.get(null);
        const chunks = (first.autoBackup as { chunks: number }).chunks;
        expect(chunks).toBeGreaterThan(1);
        expect(first[`autoBackup:${chunks - 1}`]).toBeDefined();
        expect((await readCloudBackup("auto"))?.data["refresher:memo:NICK"]).toEqual((await collectLocalData())["refresher:memo:NICK"]);

        await fakeBrowser.storage.local.set({"refresher:memo:NICK": {}});
        await runBackup("auto");
        const second = await fakeBrowser.storage.sync.get(null);
        expect((second.autoBackup as { chunks: number }).chunks).toBe(1);
        expect(second["autoBackup:1"]).toBeUndefined();
    });

    it("조각이 손상되거나 빠지면 던진다", async () => {
        await fakeBrowser.storage.local.set(local);
        await runBackup("manual");
        await fakeBrowser.storage.sync.set({"backup:0": "AAAA"});
        await expect(readCloudBackup("manual")).rejects.toThrow("백업 데이터가 맞지 않습니다.");

        // 조각이 아직 동기화되지 않았으면 손상이 아니라 빠졌다고 알린다.
        await fakeBrowser.storage.sync.remove("backup:0");
        await expect(readCloudBackup("manual")).rejects.toThrow("백업 조각이 빠져 있습니다.");
    });
});

describe("runBackup 한도", () => {
    it("쓰다 실패하면 이전 백업을 그대로 두고 이유를 남긴다", async () => {
        await fakeBrowser.storage.local.set(local);
        await runBackup("manual");
        const before = await fakeBrowser.storage.sync.get(null);
        vi.spyOn(fakeBrowser.storage.sync, "set").mockRejectedValue(new Error("QUOTA_BYTES quota exceeded"));

        await expect(runBackup("manual")).rejects.toThrow("QUOTA_BYTES");
        expect(await fakeBrowser.storage.sync.get(null)).toEqual(before);
        expect(await stored("refresher:backup:error")).toBe("저장 공간이 부족합니다.");
    });

    it("두 칸을 합쳐 한도를 넘으면 쓰지 않고 크기를 알린다", async () => {
        // 압축해도 줄지 않는 큰 값.
        const noise = Array.from({length: 60_000}, () => Math.random().toString(36).slice(2)).join("");
        await fakeBrowser.storage.local.set({"refresher:memo:UID": {u: {text: noise, color: "#fff"}}});
        await expect(runBackup("manual")).rejects.toThrow("백업이 클라우드 한도를 넘습니다.");
        expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
    });
});
