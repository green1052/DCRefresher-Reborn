// @vitest-environment node
import {describe, expect, it, vi} from "vitest";

import {mergeBackup, parseImport, pinDefaultMode, writeSettings} from "@/core/settings-transfer";
import {DEFAULT_DETECT_MODE} from "@/core/storage/items";
import type {BlockEntry} from "@/core/storage/types";

import {stored} from "../../helpers";

const NICK = "refresher:block:NICK";
const TITLE = "refresher:block:TITLE";
const DEFAULTS = "refresher:block:defaults";
const MODULES = "refresher:modules";
const SETTINGS = "refresher:module:preview:settings";
/** 없는 모듈(없어졌거나 다른 버전의 모듈)의 설정. */
const UNKNOWN_SETTINGS = "refresher:module:zzz:settings";

const entry = (content: string, fields: Partial<BlockEntry> = {}): BlockEntry => ({id: content, content, isRegex: false, ...fields});

/** 비교용: 저장할 때 새로 붙는 id를 뺀다. */
const contents = (value: unknown): unknown => (Array.isArray(value) ? value.map(({id: _, ...rest}: BlockEntry) => rest) : value);

describe("pinDefaultMode", () => {
    it("기본 모드가 다르면 모드 없는 항목에만 보낸 쪽 모드를 적는다", () => {
        const list = [entry("a"), entry("b", {mode: "SAME"})];
        expect(pinDefaultMode(list, "CONTAIN", "SAME")).toEqual([entry("a", {mode: "CONTAIN"}), entry("b", {mode: "SAME"})]);
    });

    it("기본 모드가 같으면 그대로 둔다", () => {
        const list = [entry("a")];
        expect(pinDefaultMode(list, "SAME", "SAME")).toBe(list);
    });
});

describe("mergeBackup", () => {
    it("차단 목록은 지금 항목 뒤에 백업에만 있는 항목(내용+갤러리)을 붙인다", () => {
        const merged = mergeBackup(
            {[NICK]: [entry("a"), entry("b", {gallery: "g"})]},
            {[NICK]: [entry("a", {mode: "CONTAIN"}), entry("b"), entry("c")]}
        );
        expect(contents(merged[NICK])).toEqual([
            {content: "a", isRegex: false},
            {content: "b", isRegex: false, gallery: "g"},
            {content: "b", isRegex: false},
            {content: "c", isRegex: false}
        ]);
    });

    it("기본 모드가 다른 유형은 백업에서 온 항목에 백업의 모드를 적고 이 기기 기본 모드를 남긴다", () => {
        const merged = mergeBackup(
            {[TITLE]: [entry("지금")], [DEFAULTS]: {TITLE: "SAME"}},
            {[TITLE]: [entry("백업")], [NICK]: [entry("닉")], [DEFAULTS]: {TITLE: "CONTAIN"}}
        );
        expect(contents(merged[TITLE])).toEqual([{content: "지금", isRegex: false}, {content: "백업", isRegex: false, mode: "CONTAIN"}]);
        expect(contents(merged[NICK])).toEqual([{content: "닉", isRegex: false}]);
        expect(merged[DEFAULTS]).toEqual({...DEFAULT_DETECT_MODE, TITLE: "SAME"});
    });

    it("백업에 기본 모드가 없으면 기본값을 쓴 기기로 본다", () => {
        const merged = mergeBackup({[DEFAULTS]: {NICK: "CONTAIN"}}, {[NICK]: [entry("닉")]});
        expect(contents(merged[NICK])).toEqual([{content: "닉", isRegex: false, mode: "SAME"}]);
    });

    it("설정 객체는 백업에만 있는 키를 더하고 겹치면 지금 값이 이긴다", () => {
        const merged = mergeBackup(
            {[MODULES]: {a: true}, [SETTINGS]: {width: 900}},
            {[MODULES]: {a: false, b: true}, [SETTINGS]: "깨짐", "refresher:memo:UID": {u: {text: "m", color: ""}}}
        );
        expect(merged).toEqual({
            [MODULES]: {a: true, b: true},
            [SETTINGS]: {width: 900},
            "refresher:memo:UID": {u: {text: "m", color: ""}},
            [DEFAULTS]: DEFAULT_DETECT_MODE
        });
    });
});

describe("writeSettings", () => {
    it("replace는 없는 설정 키를 지우지만 DB·모듈 캐시는 그대로 둔다", async () => {
        await browser.storage.local.set({
            [MODULES]: {a: true},
            [SETTINGS]: {width: 900},
            "refresher:db:ip": "ip",
            "refresher:module:userinfo:data": {cache: 1}
        });
        await writeSettings({[MODULES]: {b: true}, NICK: ["내보내기 전용"]}, "replace");

        expect(await browser.storage.local.get(null)).toEqual({
            [MODULES]: {b: true},
            "refresher:db:ip": "ip",
            "refresher:module:userinfo:data": {cache: 1}
        });
    });

    it("빈 객체로 replace하면 설정을 모두 지운다", async () => {
        await browser.storage.local.set({[MODULES]: {a: true}, [NICK]: [entry("a")]});
        await writeSettings({}, "replace");
        expect(await browser.storage.local.get(null)).toEqual({});
    });

    it("차단 목록에 빠진 id를 새로 붙인다", async () => {
        await writeSettings({[NICK]: [{content: "a", isRegex: false}, "깨진 항목"]}, "replace");
        const list = await stored(NICK);
        expect(contents(list)).toEqual([{content: "a", isRegex: false}]);
        expect(list).toEqual([expect.objectContaining({id: expect.any(String)})]);
    });

    it("merge는 든 키만 쓰고 설정 객체는 기존 값에 얕게 합친다", async () => {
        await browser.storage.local.set({[MODULES]: {a: true, b: true}, [NICK]: [entry("a")], [SETTINGS]: {width: 900, height: 1}});
        await writeSettings({[MODULES]: {b: false}, [SETTINGS]: {width: 1000}}, "merge");

        expect(await stored(MODULES)).toEqual({a: true, b: false});
        expect(await stored(SETTINGS)).toEqual({width: 1000, height: 1});
        expect(await stored(NICK)).toEqual([entry("a")]);
    });

    it("merge는 이 기기 기본 모드를 남기고 가져온 항목에 JSON의 기본 모드를 적는다", async () => {
        await browser.storage.local.set({[DEFAULTS]: {TITLE: "SAME"}});
        await writeSettings({[TITLE]: [entry("ㅋ")], [DEFAULTS]: {TITLE: "CONTAIN"}}, "merge");
        expect(await stored(DEFAULTS)).toEqual({TITLE: "SAME"});
        expect(contents(await stored(TITLE))).toEqual([{content: "ㅋ", isRegex: false, mode: "CONTAIN"}]);
    });

    it("merge할 JSON에 기본 모드가 없으면 기본값으로 본다", async () => {
        await browser.storage.local.set({[DEFAULTS]: {TITLE: "SAME"}});
        await writeSettings({[TITLE]: [entry("ㅋ")]}, "merge");
        expect(contents(await stored(TITLE))).toEqual([{content: "ㅋ", isRegex: false, mode: "CONTAIN"}]);
    });

    it("없는 모듈의 설정은 저장하지 않는다", async () => {
        await writeSettings({[SETTINGS]: {width: 1000}, [UNKNOWN_SETTINGS]: {width: 1}}, "merge");
        expect(await browser.storage.local.get(null)).toEqual({[SETTINGS]: {width: 1000}});
    });

    it("쓸 수 있는 설정이 없으면 던지고 아무것도 바꾸지 않는다", async () => {
        await browser.storage.local.set({[MODULES]: {a: true}});
        await expect(writeSettings({NICK: []}, "replace")).rejects.toThrow("쓸 수 있는 설정이 없습니다.");
        await expect(writeSettings({[UNKNOWN_SETTINGS]: {width: 1}}, "merge")).rejects.toThrow("쓸 수 있는 설정이 없습니다.");
        // 기본 모드만 든 JSON은 merge에서 기본 모드가 빠지므로 쓸 것이 없다.
        await expect(writeSettings({[DEFAULTS]: {NICK: "SAME"}}, "merge")).rejects.toThrow("쓸 수 있는 설정이 없습니다.");
        expect(await browser.storage.local.get(null)).toEqual({[MODULES]: {a: true}});
    });

    it("쓰다 실패하면 건드린 키만 이전 값으로 되돌린다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await browser.storage.local.set({[MODULES]: {a: true}, [SETTINGS]: {width: 900}});
        const set = vi.spyOn(browser.storage.local, "set");
        set.mockImplementationOnce(async (items) => {
            // 일부만 쓴 채 실패한 것처럼 한다.
            await browser.storage.local.remove(Object.keys(items));
            throw new Error("QUOTA_BYTES");
        });

        await expect(writeSettings({[MODULES]: {b: true}, [NICK]: [entry("a")]}, "replace")).rejects.toThrow("QUOTA_BYTES");
        expect(await browser.storage.local.get(null)).toEqual({[MODULES]: {a: true}, [SETTINGS]: {width: 900}});
    });

    it("되돌리기도 실패하면 원래 실패를 알린다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(browser.storage.local, "set").mockRejectedValue(new Error("원래 실패"));
        await expect(writeSettings({[MODULES]: {b: true}}, "merge")).rejects.toThrow("원래 실패");
        expect(console.error).toHaveBeenCalledWith("설정 되돌리기 실패:", expect.any(Error));
    });
});

describe("parseImport", () => {
    it("설정 키가 든 객체를 돌려준다", () => {
        expect(parseImport("{\"refresher:modules\":{\"a\":true},\"x\":1}")).toEqual({[MODULES]: {a: true}, x: 1});
    });

    it("객체가 아니거나 설정 키가 없으면 던진다", () => {
        expect(() => parseImport("[]")).toThrow("JSON 객체여야 합니다");
        expect(() => parseImport("null")).toThrow("JSON 객체여야 합니다");
        expect(() => parseImport("{}")).toThrow("설정 데이터가 아닙니다");
        expect(() => parseImport("{\"NICK\":[]}")).toThrow("설정 데이터가 아닙니다");
        expect(() => parseImport("{")).toThrow(SyntaxError);
    });
});
