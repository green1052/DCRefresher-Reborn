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
    it("DB·백업 상태·모듈 캐시를 빼고 차단 항목의 id를 뺀다", async () => {
        await fakeBrowser.storage.local.set(local);
        const data = await collectLocalData();
        expect(Object.keys(data).sort()).toEqual(["refresher:block:NICK", "refresher:memo:UID", "refresher:module:preview:settings", "refresher:modules"]);
        expect(JSON.stringify(data["refresher:block:NICK"])).toBe("[{\"content\":\"n\",\"isRegex\":false}]");
        expect(isBackupTarget("refresher:db")).toBe(false);
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
        expect(status.legacy).toBe(false);

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

    it("조각이 손상되면 던지고, v5 방식 백업은 수동 칸으로 읽는다", async () => {
        await fakeBrowser.storage.local.set(local);
        await runBackup("manual");
        await fakeBrowser.storage.sync.set({"backup:0": "AAAA"});
        await expect(readCloudBackup("manual")).rejects.toThrow();

        fakeBrowser.reset();
        await fakeBrowser.storage.sync.set({"refresher:modules": {block: false}, "refresher:db:ip": "big"});
        expect(await readCloudBackup("manual")).toEqual({data: {"refresher:modules": {block: false}}});
        expect((await readCloudBackupStatus()).legacy).toBe(true);
    });
});
