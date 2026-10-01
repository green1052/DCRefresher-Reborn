import {describe, expect, it} from "vitest";

import {parseBans} from "@/core/database";

describe("parseBans", () => {
    it("uid 문자열 배열인 항목만 남기고, 비었으면 빈 목록이다", () => {
        expect(parseBans("")).toEqual({});
        expect(parseBans(JSON.stringify({도배: ["a", 1, "b"], 메모: "x", 광고: []}))).toEqual({도배: ["a", "b"], 광고: []});
        expect(parseBans("[1]")).toEqual({});
        expect(() => parseBans("{")).toThrow();
    });
});
