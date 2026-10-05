import {afterEach, describe, expect, it, vi} from "vitest";

import {followDcAppearance, followSystemAppearance} from "@/utils/appearance";

import {tick} from "../../helpers";

afterEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    document.getElementById("css-darkmode")?.remove();
});

describe("followSystemAppearance", () => {
    it("시스템 다크 모드를 따르고 바뀌면 다시 맞춘다", () => {
        let onChange: ((ev: { matches: boolean }) => void) | undefined;
        vi.stubGlobal("matchMedia", () => ({
            matches: true,
            addEventListener: (_type: string, listener: (ev: { matches: boolean }) => void) => (onChange = listener)
        }));
        const root = document.documentElement;

        followSystemAppearance();
        expect(root.classList.contains("dark")).toBe(true);
        expect(root.classList.contains("light")).toBe(false);
        expect(root.style.colorScheme).toBe("dark");

        onChange?.({matches: false});
        expect(root.classList.contains("dark")).toBe(false);
        expect(root.classList.contains("light")).toBe(true);
        expect(root.style.colorScheme).toBe("light");
    });
});

describe("followDcAppearance", () => {
    it("디시 다크모드 스타일시트가 생기고 없어지는 것을 따른다", async () => {
        const root = document.createElement("div");
        const stop = followDcAppearance(root);
        expect(root.classList.contains("light")).toBe(true);

        const sheet = document.head.appendChild(Object.assign(document.createElement("link"), {id: "css-darkmode"}));
        await tick();
        expect(root.classList.contains("dark")).toBe(true);

        sheet.remove();
        await tick();
        expect(root.classList.contains("dark")).toBe(false);

        stop();
        document.head.appendChild(sheet);
        await tick();
        expect(root.classList.contains("dark")).toBe(false);
    });
});
