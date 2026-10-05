import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {
    blockListKey,
    isBlockListKey,
    moduleDataKey,
    moduleKeyModule,
    moduleSettingsKey,
    moduleSettingsStorage,
    rawKey,
    settingsKeyModule,
    writeDatabase
} from "@/core/storage/items";

import {stored} from "../../../helpers";

describe("키", () => {
    it("rawKey는 local:을 뗀다", () => {
        expect(rawKey(blockListKey("NICK"))).toBe("refresher:block:NICK");
        expect(rawKey(moduleSettingsKey("a"))).toBe("refresher:module:a:settings");
    });

    it("settingsKeyModule은 설정 키의 모듈 id만", () => {
        expect(settingsKeyModule("refresher:module:a:b:settings")).toBe("a:b");
        expect(settingsKeyModule(rawKey(moduleDataKey("a")))).toBeUndefined();
        expect(settingsKeyModule("local:refresher:module:a:settings")).toBeUndefined();
    });

    it("moduleKeyModule은 설정·캐시 키의 모듈 id", () => {
        expect(moduleKeyModule(rawKey(moduleSettingsKey("a")))).toBe("a");
        expect(moduleKeyModule(rawKey(moduleDataKey("b")))).toBe("b");
        expect(moduleKeyModule("refresher:modules")).toBeUndefined();
    });

    it("isBlockListKey는 기본 모드 키를 빼고 차단 목록 키만", () => {
        expect(isBlockListKey("refresher:block:NICK")).toBe(true);
        expect(isBlockListKey("refresher:block:defaults")).toBe(false);
        expect(isBlockListKey("refresher:memo:NICK")).toBe(false);
    });
});

describe("항목", () => {
    it("불러오기만 해서는 저장소를 읽지 않는다", async () => {
        vi.resetModules();
        const get = vi.spyOn(fakeBrowser.storage.local, "get");
        const items = await import("@/core/storage/items");
        expect(get).not.toHaveBeenCalled();

        // 처음 쓸 때 만들고 그 뒤로는 같은 항목이다.
        expect(items.modulesStorage()).toBe(items.modulesStorage());
        expect(items.backupStorage.auto).toBe(items.backupStorage.auto);
    });

    it("moduleSettingsStorage는 모듈마다 하나를 재사용한다", async () => {
        expect(moduleSettingsStorage("a")).toBe(moduleSettingsStorage("a"));
        expect(moduleSettingsStorage("a")).not.toBe(moduleSettingsStorage("b"));
        expect(await moduleSettingsStorage("a").getValue()).toEqual({});
    });

    it("writeDatabase는 세 키를 한 번에 쓴다", async () => {
        const set = vi.spyOn(fakeBrowser.storage.local, "set");

        await writeDatabase({version: "1", lastUpdate: 2}, "ip", "ban");

        expect(set).toHaveBeenCalledTimes(1);
        expect(await stored("refresher:db:meta")).toEqual({version: "1", lastUpdate: 2});
        expect(await stored("refresher:db:ip")).toBe("ip");
        expect(await stored("refresher:db:ban")).toBe("ban");
    });
});
