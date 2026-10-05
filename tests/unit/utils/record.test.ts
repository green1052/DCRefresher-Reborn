import {expect, it} from "vitest";

import {isRecord} from "@/utils/record";

it("배열이 아닌 객체만 record다", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
    for (const value of [null, undefined, [], "a", 1, true]) expect(isRecord(value)).toBe(false);
});
