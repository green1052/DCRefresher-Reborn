import {afterEach, describe, expect, it} from "vitest";

import {overlay} from "@/components/overlay/shadow";
import {eventTarget, isTyping, pressedKey} from "@/utils/event";

afterEach(() => {
    document.body.innerHTML = "";
    overlay.portal = undefined;
});

/** element에서 keydown을 보내 document 리스너가 본 값을 돌려준다. composedPath는 디스패치 중에만 채워져 있다. */
interface Seen {
    target: EventTarget | null;
    picked: EventTarget | null;
    typing: boolean;
}

const dispatchFrom = (element: Element): Seen => {
    let seen: Seen = {target: null, picked: null, typing: false};
    const listener = (ev: Event): void => {
        seen = {target: ev.target, picked: eventTarget(ev), typing: isTyping(ev)};
    };
    document.addEventListener("keydown", listener);
    element.dispatchEvent(new KeyboardEvent("keydown", {bubbles: true, composed: true}));
    document.removeEventListener("keydown", listener);
    return seen;
};

describe("eventTarget", () => {
    it("shadow DOM 안의 실제 대상을 되찾는다", () => {
        const host = document.body.appendChild(document.createElement("div"));
        const input = host.attachShadow({mode: "open"}).appendChild(document.createElement("input"));
        const seen = dispatchFrom(input);
        expect(seen.target).toBe(host);
        expect(seen.picked).toBe(input);
        expect(seen.typing).toBe(true);
    });

    it("디스패치 밖에서는 target을 쓴다", () => {
        expect(eventTarget(new Event("x"))).toBeNull();
    });
});

describe("pressedKey", () => {
    it("한글 입력 상태에서도 영문·숫자는 물리 키로 읽는다", () => {
        expect(pressedKey({code: "KeyA", key: "ㅁ"})).toBe("a");
        expect(pressedKey({code: "KeyS", key: "Process"})).toBe("s");
        expect(pressedKey({code: "Digit1", key: "!"})).toBe("1");
    });

    it("그 밖의 키는 key를 소문자로 쓴다", () => {
        expect(pressedKey({code: "Enter", key: "Enter"})).toBe("enter");
        expect(pressedKey({code: "Numpad1", key: "1"})).toBe("1");
    });
});

describe("isTyping", () => {
    it("입력칸·textarea에서는 true다", () => {
        for (const tag of ["input", "textarea"]) expect(dispatchFrom(document.body.appendChild(document.createElement(tag))).typing).toBe(true);
    });

    it("다른 요소에서는 false다", () => {
        // jsdom에는 isContentEditable이 없어 false 대신 undefined가 나온다.
        expect(dispatchFrom(document.body.appendChild(document.createElement("button"))).typing).toBeFalsy();
    });

    it("모달 다이얼로그가 떠 있으면 입력칸 밖에서도 true다", () => {
        overlay.portal = document.createElement("div");
        overlay.portal.innerHTML = "<div data-slot=\"dialog-overlay\"></div>";
        expect(dispatchFrom(document.body.appendChild(document.createElement("button"))).typing).toBe(true);
    });
});
