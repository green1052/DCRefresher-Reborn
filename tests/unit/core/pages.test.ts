import {describe, expect, it} from "vitest";

import {BOARD_PAGE, isBlockedPage, LIST_PAGE, VIEW_PAGE, WRITE_PAGE} from "@/core/pages";

describe("isBlockedPage", () => {
    it("본문이 빈 문서만 임시 차단으로 본다", () => {
        expect(isBlockedPage("<html><head><title>x</title></head><body>\n  </body></html>")).toBe(true);
        expect(isBlockedPage("<html><body class=\"a\"><p>글</p></body></html>")).toBe(false);
        expect(isBlockedPage("")).toBe(true);
        expect(isBlockedPage("{\"comments\":[]}")).toBe(false);
    });
});

describe("페이지 패턴", () => {
    it("목록·본문·글쓰기를 가른다", () => {
        expect(BOARD_PAGE.test("https://gall.dcinside.com/mgallery/board/lists/?id=a")).toBe(true);
        expect(BOARD_PAGE.test("https://gall.dcinside.com/board/view/?id=a&no=1")).toBe(true);
        expect(BOARD_PAGE.test("https://gall.dcinside.com/board/write/?id=a")).toBe(false);
        expect(LIST_PAGE.test("https://gall.dcinside.com/board/view/?id=a")).toBe(false);
        expect(VIEW_PAGE.test("https://gall.dcinside.com/board/view/?id=a")).toBe(true);
        expect(WRITE_PAGE.test("https://gall.dcinside.com/board/modify/?id=a")).toBe(true);
    });
});
