import {describe, expect, it} from "vitest";

import {pressedKey} from "@/utils/event";

describe("pressedKey", () => {
    it("한글 입력 상태여도 물리 키로 영문·숫자를 읽는다", () => {
        expect(pressedKey({code: "KeyD", key: "ㅇ"})).toBe("d");
        expect(pressedKey({code: "Digit1", key: "!"})).toBe("1");
        expect(pressedKey({code: "Escape", key: "Escape"})).toBe("escape");
    });
});
