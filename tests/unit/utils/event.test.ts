import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {overlay} from "@/components/overlay/shadow";
import {isTyping} from "@/utils/event";

describe("isTyping", () => {
    let shadow: ShadowRoot;

    // 콘텐츠 스크립트처럼 포털 칸을 shadow DOM 안에 둔다.
    beforeEach(() => {
        const host = document.createElement("div");
        document.body.append(host);
        shadow = host.attachShadow({mode: "open"});
        const portal = document.createElement("div");
        shadow.append(portal);
        overlay.portal = portal;
    });

    afterEach(() => {
        overlay.portal = undefined;
        document.body.replaceChildren();
    });

    /** target에서 keydown을 보내고, 단축키처럼 window에서 받은 isTyping 결과를 돌려준다. */
    const typingOn = (target: EventTarget): boolean | undefined => {
        let result: boolean | undefined;
        window.addEventListener("keydown", (ev) => void (result = isTyping(ev)), {once: true});
        target.dispatchEvent(new KeyboardEvent("keydown", {key: "PageDown", bubbles: true, composed: true}));
        return result;
    };

    it("포커스가 없고 다이얼로그도 없으면 단축키를 받는다", () => {
        expect(typingOn(document)).toBe(false);
    });

    it("shadow DOM 안 입력칸에 타이핑 중이면 막는다", () => {
        const input = document.createElement("input");
        shadow.append(input);
        expect(typingOn(input)).toBe(true);
    });

    // 확인 창의 버튼처럼 입력칸이 아닌 곳에 포커스가 있어도 막아야 뒤의 미리보기가 옆 글로 넘어가지 않는다.
    it.each(["dialog-overlay", "alert-dialog-overlay"])("포털에 %s가 떠 있으면 막는다", (slot) => {
        const backdrop = document.createElement("div");
        backdrop.dataset.slot = slot;
        const button = document.createElement("button");
        overlay.portal?.append(backdrop, button);
        expect(typingOn(button)).toBe(true);
    });
});
