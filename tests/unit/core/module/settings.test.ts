// @vitest-environment node
import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {areEqual, defaultValue, enablesOf, isModuleEnabled, normalizeSetting, readModuleStorage, settingsOf} from "@/core/module/settings";

import {setting} from "../../../helpers";

describe("isModuleEnabled", () => {
    it("저장값이 boolean이면 그 값을 쓴다", () => {
        expect(isModuleEnabled({id: "a", defaultEnable: true}, {a: false})).toBe(false);
        expect(isModuleEnabled({id: "a", defaultEnable: false}, {a: true})).toBe(true);
    });

    it("boolean이 아니면 defaultEnable, 없으면 켠다", () => {
        expect(isModuleEnabled({id: "a", defaultEnable: false}, {a: "true"})).toBe(false);
        expect(isModuleEnabled({id: "a", defaultEnable: true}, {a: "false"})).toBe(true);
        expect(isModuleEnabled({id: "a"}, {})).toBe(true);
    });
});

describe("defaultValue", () => {
    it("order 기본값은 복사본이다", () => {
        const schema = setting({type: "order", default: ["x", "y"], items: {x: "", y: ""}});
        const value = defaultValue(schema);
        expect(value).toEqual(["x", "y"]);
        expect(value).not.toBe(schema.default);
    });
});

describe("normalizeSetting", () => {
    const range = setting({type: "range", default: 5, min: 1, max: 10, step: 0.5, unit: ""});

    it("check·text는 타입이 틀리면 기본값", () => {
        const check = setting({type: "check", default: true});
        expect(normalizeSetting(check, false)).toBe(false);
        expect(normalizeSetting(check, "false")).toBe(true);
        const text = setting({type: "text", default: "d"});
        expect(normalizeSetting(text, "")).toBe("");
        expect(normalizeSetting(text, 1)).toBe("d");
    });

    it("option은 항목에 있는 자기 키만 받는다", () => {
        const option = setting({type: "option", default: "a", items: {a: "", b: ""}});
        expect(normalizeSetting(option, "b")).toBe("b");
        expect(normalizeSetting(option, "c")).toBe("a");
        expect(normalizeSetting(option, "toString")).toBe("a");
    });

    it("key는 소문자 영문·숫자 한 글자만", () => {
        const key = setting({type: "key", default: "q"});
        expect(normalizeSetting(key, "z")).toBe("z");
        expect(normalizeSetting(key, "7")).toBe("7");
        for (const bad of ["A", "ab", "", " "]) expect(normalizeSetting(key, bad)).toBe("q");
    });

    it("color는 #rrggbb만", () => {
        const color = setting({type: "color", default: "#000000"});
        expect(normalizeSetting(color, "#AbCdEf")).toBe("#AbCdEf");
        for (const bad of ["#fff", "red", "#gggggg"]) expect(normalizeSetting(color, bad)).toBe("#000000");
    });

    it("range는 step에 맞춰 반올림하고 범위로 자른다", () => {
        expect(normalizeSetting(range, 3.3)).toBe(3.5);
        expect(normalizeSetting(range, 9999)).toBe(10);
        expect(normalizeSetting(range, -5)).toBe(1);
    });

    it("range는 숫자가 아니거나 유한하지 않으면 기본값", () => {
        for (const bad of ["3", Number.NaN, Number.POSITIVE_INFINITY, null]) expect(normalizeSetting(range, bad)).toBe(5);
    });

    it("order는 모르는·겹친 항목을 빼고 빠진 항목을 뒤에 붙인다", () => {
        const order = setting({type: "order", default: ["a", "b", "c"], items: {a: "", b: "", c: ""}});
        expect(normalizeSetting(order, ["c", "x", "c", 1, "a"])).toEqual(["c", "a", "b"]);
        expect(normalizeSetting(order, "a,b")).toEqual(["a", "b", "c"]);
    });
});

describe("areEqual", () => {
    it("배열은 내용으로 비교한다", () => {
        expect(areEqual(["a", "b"], ["a", "b"])).toBe(true);
        expect(areEqual(["a", "b"], ["b", "a"])).toBe(false);
        expect(areEqual(["a"], ["a", "b"])).toBe(false);
        expect(areEqual(undefined, false)).toBe(false);
        expect(areEqual(1, 1)).toBe(true);
    });
});

describe("enablesOf", () => {
    it("객체가 아니면 빈 객체", () => {
        expect(enablesOf({a: true})).toEqual({a: true});
        for (const bad of [null, [true], "x"]) expect(enablesOf(bad)).toEqual({});
    });
});

describe("settingsOf", () => {
    it("스키마의 키만 맞춰 돌려주고 모양이 틀리면 기본값", () => {
        const def = {settings: {flag: setting({type: "check", default: true}), size: setting({type: "range", default: 5, min: 1, max: 10, step: 1, unit: ""})}};
        expect(settingsOf(def, {flag: false, gone: 1})).toEqual({flag: false, size: 5});
        expect(settingsOf(def, [false])).toEqual({flag: true, size: 5});
        expect(settingsOf({}, {flag: false})).toEqual({});
    });
});

describe("readModuleStorage", () => {
    it("on/off와 모든 설정을 한 번에 읽고, 없는 설정은 null", async () => {
        await fakeBrowser.storage.local.set({"refresher:modules": {a: false}, "refresher:module:a:settings": {x: 1}});
        const get = vi.spyOn(fakeBrowser.storage.local, "get");

        const {enables, settings} = await readModuleStorage(["a", "b"]);

        expect(get).toHaveBeenCalledTimes(1);
        expect(enables).toEqual({a: false});
        expect(settings).toEqual(new Map([["a", {x: 1}], ["b", null]]));
    });

    it("on/off 값의 모양이 틀리면 빈 객체", async () => {
        await fakeBrowser.storage.local.set({"refresher:modules": ["a"]});
        expect((await readModuleStorage([])).enables).toEqual({});
    });
});
