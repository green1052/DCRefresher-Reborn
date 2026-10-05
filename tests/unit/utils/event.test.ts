import {afterEach, describe, expect, it} from "vitest";

import {overlay} from "@/components/overlay/shadow";
import {isTyping, pressedKey} from "@/utils/event";

describe("pressedKey", () => {
    it("한글 입력 상태여도 물리 키로 영문·숫자를 읽는다", () => {
        expect(pressedKey({code: "KeyD", key: "ㅇ"})).toBe("d");
        expect(pressedKey({code: "Digit1", key: "!"})).toBe("1");
        expect(pressedKey({code: "Escape", key: "Escape"})).toBe("escape");
    });
});

describe("isTyping", () => {
    afterEach(() => {
        overlay.portal = undefined;
        document.body.replaceChildren();
    });

    const keydownOn = (target: EventTarget): KeyboardEvent => {
        let caught: KeyboardEvent | undefined;
        target.addEventListener("keydown", (ev) => (caught = ev as KeyboardEvent), {once: true});
        target.dispatchEvent(new KeyboardEvent("keydown", {key: "d", bubbles: true}));
        return caught!;
    };

    it("입력칸에서 친 키는 단축키로 보지 않는다", () => {
        const input = document.body.appendChild(document.createElement("input"));
        expect(isTyping(keydownOn(input))).toBe(true);
        // jsdom은 isContentEditable이 없어 false 대신 undefined가 나온다.
        expect(isTyping(keydownOn(document.body))).toBeFalsy();
    });

    it("오버레이에 모달 다이얼로그가 떠 있으면 포커스가 어디든 단축키를 막는다", () => {
        overlay.portal = document.body.appendChild(document.createElement("div"));
        expect(isTyping(keydownOn(document.body))).toBeFalsy();

        const backdrop = overlay.portal.appendChild(document.createElement("div"));
        backdrop.dataset.slot = "dialog-overlay";
        expect(isTyping(keydownOn(document.body))).toBe(true);
    });
});
