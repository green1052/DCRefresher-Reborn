import {describe, expect, it} from "vitest";

import {arrayIncludes, objectEntries, objectFromEntries, objectKeys} from "@/utils/typed";

describe("typed", () => {
    it("Object 도우미는 내장 함수와 같은 값을 준다", () => {
        const value = {a: 1, 2: "b"};
        expect(objectKeys(value)).toEqual(Object.keys(value));
        expect(objectEntries(value)).toEqual(Object.entries(value));
        expect(objectFromEntries([["x", 1], ["y", 2]] as const)).toEqual({x: 1, y: 2});
    });

    it("arrayIncludes는 원소인지 본다", () => {
        const kinds = ["a", "b"] as const;
        expect(arrayIncludes(kinds, "a")).toBe(true);
        expect(arrayIncludes(kinds, "c")).toBe(false);
    });
});
