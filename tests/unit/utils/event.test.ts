import {describe, expect, it} from "vitest";

import {pressedKey} from "@/utils/event";
import {friendlyMessage, messageOf} from "@/utils/error";

describe("pressedKey", () => {
    it("한글 입력 상태여도 물리 키로 영문·숫자를 읽는다", () => {
        expect(pressedKey({code: "KeyD", key: "ㅇ"})).toBe("d");
        expect(pressedKey({code: "Digit1", key: "!"})).toBe("1");
        expect(pressedKey({code: "Escape", key: "Escape"})).toBe("escape");
    });
});

describe("messageOf / friendlyMessage", () => {
    it("다른 영역의 오류도 메시지를 꺼내고, 영어 원문은 안내 문구로 바꾼다", () => {
        expect(messageOf({message: "m"})).toBe("m");
        expect(messageOf("s")).toBe("s");
        expect(friendlyMessage(new Error("이미 한국어"))).toBe("이미 한국어");
        expect(friendlyMessage(new TypeError("Failed to fetch"))).toBe("서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
        expect(friendlyMessage(new SyntaxError("Unexpected token"))).toBe("JSON 형식이 올바르지 않습니다.");
        expect(friendlyMessage(new Error("QUOTA_BYTES quota exceeded"))).toBe("저장 공간이 부족합니다.");
        expect(friendlyMessage(new DOMException("x", "TimeoutError"))).toBe("응답이 없습니다. 잠시 후 다시 시도해 주세요.");
        expect(friendlyMessage(new Error("something else"))).toBe("잠시 후 다시 시도해 주세요.");
    });
});
