import {describe, expect, it} from "vitest";

import {
    BLOCK_TYPES,
    blockListKey,
    DB_KEYS,
    isBlockListKey,
    memoMapKey,
    MODULES_KEY,
    moduleDataKey,
    moduleKeyModule,
    moduleSettingsKey,
    settingsKeyModule,
    rawKey,
    writeDatabase,
    TYPE_NAMES,
    DETECT_MODES,
    MEMO_TYPES
} from "@/core/storage/items";

import {stored} from "../../../helpers";

describe("저장소 키 도우미", () => {
    it("WXT 키에서 local: 접두사를 뗀다", () => {
        expect(rawKey(MODULES_KEY)).toBe("refresher:modules");
        expect(rawKey(blockListKey("NICK"))).toBe("refresher:block:NICK");
    });

    it("키마다 정해진 모양을 만든다", () => {
        expect(blockListKey("DCCON")).toBe(`local:refresher:block:DCCON`);
        expect(memoMapKey("UID")).toBe(`local:refresher:memo:UID`);
        expect(moduleSettingsKey("preview")).toBe(`local:refresher:module:preview:settings`);
        expect(moduleDataKey("userinfo")).toBe(`local:refresher:module:userinfo:data`);
    });

    it("키에서 모듈 id를 읽고 종류를 가린다", () => {
        expect(settingsKeyModule("refresher:module:preview:settings")).toBe("preview");
        expect(settingsKeyModule("refresher:block:NICK")).toBeUndefined();

        expect(moduleKeyModule("refresher:module:preview:settings")).toBe("preview");
        expect(moduleKeyModule("refresher:module:userinfo:data")).toBe("userinfo");
        expect(moduleKeyModule("refresher:modules")).toBeUndefined();

        // 차단 목록 키는 대문자 유형만: 기본 차단 모드(refresher:block:defaults)는 아니다.
        expect(isBlockListKey("refresher:block:NICK")).toBe(true);
        expect(isBlockListKey("refresher:block:defaults")).toBe(false);
        expect(isBlockListKey("refresher:memo:UID")).toBe(false);
    });

    it("이름표 순서가 곧 유형 배열의 순서다", () => {
        expect(BLOCK_TYPES).toEqual(Object.keys(TYPE_NAMES));
        expect(DETECT_MODES).toEqual(["SAME", "CONTAIN", "NOT_SAME", "NOT_CONTAIN"]);
        expect(MEMO_TYPES).toEqual(["UID", "NICK", "IP"]);
    });
});

describe("writeDatabase", () => {
    it("세 키를 한 번에 쓴다", async () => {
        await writeDatabase({version: "v1", lastUpdate: 123, format: 2}, "ip-data", "ban-data");

        expect(await stored("refresher:db:meta")).toEqual({version: "v1", lastUpdate: 123, format: 2});
        expect(await stored(rawKey(DB_KEYS.ip))).toBe("ip-data");
        expect(await stored(rawKey(DB_KEYS.ban))).toBe("ban-data");
    });
});
