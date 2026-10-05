import {describe, expect, it} from "vitest";

import {BOARD_PAGE, isBlockedPage, LIST_PAGE, VIEW_PAGE, WRITE_PAGE} from "@/core/pages";

describe("isBlockedPage", () => {
    it("본문이 빈 문서는 임시 차단이다", () => {
        expect(isBlockedPage("<html><head><title>x</title></head><body></body></html>")).toBe(true);
        expect(isBlockedPage("<html><body class='a'>\n  \t</body></html>")).toBe(true);
        expect(isBlockedPage("")).toBe(true);
        expect(isBlockedPage("   ")).toBe(true);
    });

    it("본문이 있으면 차단이 아니다", () => {
        expect(isBlockedPage("<html><body><div>글</div></body></html>")).toBe(false);
        // head만 있고 본문 태그가 없어도 내용이 있으면 차단이 아니다.
        expect(isBlockedPage("<html><head></head></html>")).toBe(false);
    });

    it("JSON이나 글자 응답은 그대로 본다", () => {
        expect(isBlockedPage("true")).toBe(false);
        expect(isBlockedPage("{\"comments\":[]}")).toBe(false);
    });

    it("body 속성의 >나 닫는 태그 뒤 내용에 속지 않는다", () => {
        expect(isBlockedPage("<body data-x='1'></body><script>after()</script>")).toBe(true);
        expect(isBlockedPage("<body><p>a</p></body></html>")).toBe(false);
    });
});

describe("페이지 패턴", () => {
    it("목록·본문·글쓰기를 가른다", () => {
        const list = "/mgallery/board/lists/?id=test";
        const view = "/board/view/?id=test&no=1";
        const write = "/board/write/?id=test";
        const modify = "/board/modify/?id=test&no=1";

        expect([list, view, write, modify].map((path) => BOARD_PAGE.test(path))).toEqual([true, true, false, false]);
        expect([list, view, write, modify].map((path) => VIEW_PAGE.test(path))).toEqual([false, true, false, false]);
        expect([list, view, write, modify].map((path) => LIST_PAGE.test(path))).toEqual([true, false, false, false]);
        expect([list, view, write, modify].map((path) => WRITE_PAGE.test(path))).toEqual([false, false, true, true]);
    });
});
