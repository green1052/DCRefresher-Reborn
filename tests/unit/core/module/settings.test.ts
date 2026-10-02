import {describe, expect, it} from "vitest";

import {areEqual, defaultValue, isModuleEnabled, normalizeSetting, settingsOf} from "@/core/module/settings";

import {setting} from "../../../helpers";

const range = setting({type: "range", default: 5000, min: 3000, max: 20000, step: 100, unit: "ms"});
const order = setting({type: "order", items: {UID: "", MEMO: "", RATIO: "", PERMBAN: ""}, default: ["UID", "MEMO", "RATIO", "PERMBAN"]});

describe("isModuleEnabled", () => {
    it("저장값이 boolean이면 그 값, 아니면 defaultEnable(기본 true)을 따른다", () => {
        expect(isModuleEnabled({id: "a"}, {a: false})).toBe(false);
        expect(isModuleEnabled({id: "a"}, {})).toBe(true);
        expect(isModuleEnabled({id: "a", defaultEnable: false}, {})).toBe(false);
        // 가져온 설정의 "false" 문자열은 boolean이 아니므로 기본값.
        expect(isModuleEnabled({id: "a", defaultEnable: false}, {a: "true"})).toBe(false);
    });
});

describe("normalizeSetting", () => {
    it("타입이 틀리면 기본값을 쓴다", () => {
        expect(normalizeSetting(setting({type: "check", default: true}), "yes")).toBe(true);
        expect(normalizeSetting(setting({type: "text", default: "x"}), 3)).toBe("x");
        expect(normalizeSetting(setting({type: "option", default: "a", items: {a: "", b: ""}}), "c")).toBe("a");
        expect(normalizeSetting(setting({type: "option", default: "a", items: {a: "", b: ""}}), "b")).toBe("b");
        // 프로토타입 키는 항목이 아니다.
        expect(normalizeSetting(setting({type: "option", default: "a", items: {a: ""}}), "constructor")).toBe("a");
    });

    it("range는 step 단위로 맞춰 min~max로 자른다", () => {
        expect(normalizeSetting(range, 5049)).toBe(5000);
        expect(normalizeSetting(range, 5050)).toBe(5100);
        expect(normalizeSetting(range, 100)).toBe(3000);
        expect(normalizeSetting(range, 99999)).toBe(20000);
        expect(normalizeSetting(range, Number.NaN)).toBe(5000);
        expect(normalizeSetting(range, "5000")).toBe(5000);
    });

    it("key·color는 형식에 맞는 값만 받는다", () => {
        expect(normalizeSetting(setting({type: "key", default: "d"}), "b")).toBe("b");
        expect(normalizeSetting(setting({type: "key", default: "d"}), "B")).toBe("d");
        expect(normalizeSetting(setting({type: "key", default: "d"}), "ab")).toBe("d");
        expect(normalizeSetting(setting({type: "color", default: "#000000"}), "#ABCDEF")).toBe("#ABCDEF");
        expect(normalizeSetting(setting({type: "color", default: "#000000"}), "red")).toBe("#000000");
    });

    it("order는 모르는 항목과 겹친 항목을 빼고 새 항목을 뒤에 붙인다", () => {
        expect(normalizeSetting(order, ["MEMO", "UID", "MEMO", "X", 3])).toEqual(["MEMO", "UID", "RATIO", "PERMBAN"]);
        expect(normalizeSetting(order, "UID")).toEqual(["UID", "MEMO", "RATIO", "PERMBAN"]);
    });

    it("order·defaultValue는 스키마 기본값을 복사해 돌려준다", () => {
        const value = defaultValue(order);
        expect(value).toEqual(order.default);
        expect(value).not.toBe(order.default);
        expect(normalizeSetting(order, undefined)).not.toBe(order.default);
    });
});

describe("settingsOf", () => {
    it("스키마의 모든 키를 채우고 없는 키는 버린다", () => {
        const def = {settings: {a: setting({type: "check", default: true}), r: range}} as const;
        expect(settingsOf(def, {a: false, zzz: 1})).toEqual({a: false, r: 5000});
        expect(settingsOf(def, null)).toEqual({a: true, r: 5000});
        expect(settingsOf(def, ["a"])).toEqual({a: true, r: 5000});
        expect(settingsOf({}, {a: 1})).toEqual({});
    });
});

describe("areEqual", () => {
    it("배열은 원소로 비교한다", () => {
        expect(areEqual(["a", "b"], ["a", "b"])).toBe(true);
        expect(areEqual(["a", "b"], ["b", "a"])).toBe(false);
        expect(areEqual(undefined, "a")).toBe(false);
        expect(areEqual(1, 1)).toBe(true);
    });
});
