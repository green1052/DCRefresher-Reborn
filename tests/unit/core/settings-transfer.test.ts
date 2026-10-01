import {describe, expect, it} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {mergeBackup, parseImport, pinDefaultMode, writeSettings} from "@/core/settings-transfer";

const strip = (list: unknown) => (list as { content: string; mode?: string }[]).map(({content, mode}) => (mode ? {content, mode} : {content}));

describe("pinDefaultMode", () => {
    it("기본 모드가 다르면 모드 없는 항목에만 보낸 쪽 모드를 적고, 같으면 그대로 둔다", () => {
        const list = [{id: "1", content: "a", isRegex: false}, {id: "2", content: "b", isRegex: false, mode: "SAME" as const}];
        expect(pinDefaultMode(list, "CONTAIN", "SAME").map((entry) => entry.mode)).toEqual(["CONTAIN", "SAME"]);
        expect(pinDefaultMode(list, "SAME", "SAME")).toBe(list);
    });
});

describe("mergeBackup", () => {
    it("차단 목록은 백업에만 있는 항목을 붙이고, 기본 모드가 다르면 백업 항목에 그 모드를 적는다", () => {
        const merged = mergeBackup(
            {"refresher:block:NICK": [{content: "a", isRegex: false}], "refresher:block:defaults": {NICK: "SAME"}},
            {"refresher:block:NICK": [{content: "a", isRegex: false}, {content: "b", isRegex: false}], "refresher:block:defaults": {NICK: "CONTAIN"}}
        );
        expect(strip(merged["refresher:block:NICK"])).toEqual([{content: "a"}, {content: "b", mode: "CONTAIN"}]);
        // 기본 모드는 이 기기 것을 남긴다
        expect(merged["refresher:block:defaults"]).toMatchObject({NICK: "SAME"});
    });

    it("설정 객체는 백업에만 있는 키를 더하고, 겹치면 지금 값이 이긴다", () => {
        const merged = mergeBackup(
            {"refresher:module:refresh:settings": {fadeIn: false}},
            {"refresher:module:refresh:settings": {fadeIn: true, delay: 5}, "refresher:modules": {stealth: true}}
        );
        expect(merged["refresher:module:refresh:settings"]).toEqual({fadeIn: false, delay: 5});
        expect(merged["refresher:modules"]).toEqual({stealth: true});
    });
});

describe("writeSettings", () => {
    it("replace는 백업에 없는 설정 키를 지우지만 DB·모듈 캐시는 그대로 둔다", async () => {
        await fakeBrowser.storage.local.set({
            "refresher:modules": {stealth: true},
            "refresher:block:NICK": [{content: "old", isRegex: false}],
            "refresher:db:meta": {version: "1"},
            "refresher:module:userinfo:data": {ratio: {}}
        });

        await writeSettings({"refresher:modules": {manage: true}}, "replace");

        const stored = await fakeBrowser.storage.local.get(null);
        expect(stored["refresher:modules"]).toEqual({manage: true});
        expect(stored["refresher:block:NICK"]).toBeUndefined();
        expect(stored["refresher:db:meta"]).toEqual({version: "1"});
        expect(stored["refresher:module:userinfo:data"]).toEqual({ratio: {}});
    });

    it("merge는 든 키만 쓰고 설정 객체는 기존 값에 얕게 합친다", async () => {
        await fakeBrowser.storage.local.set({
            "refresher:modules": {stealth: true},
            "refresher:memo:UID": {u: {text: "t", color: ""}}
        });

        await writeSettings({"refresher:modules": {manage: true}, NICK: ["x"]}, "merge");

        const stored = await fakeBrowser.storage.local.get(null);
        expect(stored["refresher:modules"]).toEqual({stealth: true, manage: true});
        expect(stored["refresher:memo:UID"]).toEqual({u: {text: "t", color: ""}});
        expect(stored.NICK).toBeUndefined();
    });

    it("쓸 수 있는 설정이 없으면 던진다", async () => {
        await expect(writeSettings({NICK: ["x"]}, "merge")).rejects.toThrow("쓸 수 있는 설정이 없습니다.");
    });
});

describe("parseImport", () => {
    it("설정 키가 없는 JSON과 객체가 아닌 값은 던진다", () => {
        expect(parseImport("{\"refresher:modules\": {}}")).toEqual({"refresher:modules": {}});
        expect(() => parseImport("[]")).toThrow("JSON 객체");
        expect(() => parseImport("{\"NICK\": []}")).toThrow("설정 데이터가 아닙니다.");
    });
});
