import {beforeEach, describe, expect, it, vi} from "vitest";

import {showInvalidatedNote} from "@/entrypoints/content/invalidated";

const page = vi.hoisted(() => ({url: new URL("https://gall.dcinside.com/board/lists?id=a")}));
vi.mock("@/core/http/urls", () => ({
    get documentUrl() {
        return page.url;
    }
}));

beforeEach(() => void (document.body.innerHTML = ""));

const note = () => document.querySelector<HTMLElement>("[role=status]");

describe("showInvalidatedNote", () => {
    it("새로고침을 안내하고 누르면 닫힌다", () => {
        showInvalidatedNote();

        expect(note()?.textContent).toMatch(/새로고침해 주세요\.$/);
        expect(note()?.textContent).not.toContain("작성 중인 글");
        note()?.click();
        expect(note()).toBeNull();
    });

    it("글쓰기 페이지면 글을 먼저 등록하라고 한다", () => {
        page.url = new URL("https://gall.dcinside.com/board/write/?id=a");
        showInvalidatedNote();
        expect(note()?.textContent).toContain("작성 중인 글은 등록한 뒤 새로고침해 주세요.");
    });
});
