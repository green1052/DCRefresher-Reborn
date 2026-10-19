import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {showInvalidatedNote} from "@/entrypoints/content/invalidated";

const note = () => document.querySelector<HTMLElement>("[role=status]");
const copyButton = () => [...document.querySelectorAll("button")].find((button) => button.textContent !== "×");

beforeEach(() => {
    document.body.innerHTML = "";
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("showInvalidatedNote", () => {
    it("입력하던 글이 없으면 새로고침만 권하고 복사 버튼을 달지 않는다", () => {
        showInvalidatedNote();

        expect(note()?.textContent).toContain("새로고침해 주세요.");
        expect(copyButton()).toBeUndefined();
    });

    it("복사 버튼은 안내를 닫지 않고 입력하던 글을 복사한다", async () => {
        const writeText = vi.fn(() => Promise.resolve());
        vi.stubGlobal("navigator", {clipboard: {writeText}});

        showInvalidatedNote("반쯤 쓴 댓글");
        expect(note()?.textContent).toContain("입력하던 글을 복사해 둔 뒤 새로고침해 주세요.");
        const copy = copyButton()!;
        copy.click();

        expect(writeText).toHaveBeenCalledWith("반쯤 쓴 댓글");
        expect(note()).not.toBeNull();
        await vi.waitFor(() => expect(copy.textContent).toBe("복사했습니다"));
    });

    it("안내를 누르면 닫힌다", () => {
        showInvalidatedNote("글");

        note()!.click();

        expect(note()).toBeNull();
    });
});
