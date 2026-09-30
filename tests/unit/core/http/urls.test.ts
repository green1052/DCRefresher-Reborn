import {describe, expect, it} from "vitest";

import {galleryPath, galleryTypeName, isMiniGallery, listUrl, mergeParamURL, postSearchUrl, rowPostNo} from "@/core/http/urls";

describe("galleryPath / galleryTypeName", () => {
    it("갤러리 종류를 URL에서 읽는다", () => {
        expect(galleryPath("https://gall.dcinside.com/board/lists/?id=a")).toBe("");
        expect(galleryPath("https://gall.dcinside.com/mgallery/board/view/?id=a")).toBe("mgallery/");
        expect(galleryPath("https://gall.dcinside.com/mini/board/lists/?id=a")).toBe("mini/");
        expect(galleryPath("https://gall.dcinside.com/person/board/lists/?id=a")).toBe("person/");
        expect(galleryTypeName("https://gall.dcinside.com/mini/board/lists/?id=a")).toBe("MI");
        expect(galleryTypeName("https://gall.dcinside.com/board/lists/?id=a")).toBe("G");
        expect(isMiniGallery("https://gall.dcinside.com/mini/board/lists/?id=a")).toBe(true);
    });
});

describe("listUrl", () => {
    it("글 주소와 목록 주소가 같은 목록 주소가 된다", () => {
        const list = "https://gall.dcinside.com/mgallery/board/lists?id=a&page=1&s_keyword=x";
        expect(listUrl("https://gall.dcinside.com/mgallery/board/view/?s_keyword=x&id=a&no=3&t=1&page=1")).toBe(listUrl(list));
        expect(listUrl(list)).toBe("https://gall.dcinside.com/mgallery/board/lists?id=a&s_keyword=x");
        expect(listUrl("https://gall.dcinside.com/board/lists?id=a&page=2")).toBe("https://gall.dcinside.com/board/lists?id=a&page=2");
    });
});

describe("mergeParamURL", () => {
    it("원래 쿼리에 새 쿼리를 덮어쓴다", () => {
        expect(mergeParamURL("https://x.com/?id=a&no=1&page=1", "https://x.com/?page=2&id=a")).toBe("?id=a&no=1&page=2");
    });
});

describe("postSearchUrl", () => {
    it("검색어의 UTF-8 바이트를 .XX로 쓴다", () => {
        expect(postSearchUrl("a/가")).toBe("https://search.dcinside.com/post/sort/latest/q/.61.2F.EA.B0.80");
    });
});

describe("rowPostNo", () => {
    it("data-no가 있으면 그것, 없으면 같은 갤러리 제목 링크의 no", () => {
        history.replaceState(null, "", "/board/lists/?id=test");
        const row = document.createElement("tr");
        row.innerHTML = "<td class=\"gall_tit\"><a href=\"/board/view/?id=test&no=12\">t</a></td>";
        expect(rowPostNo(row)).toBe("12");
        row.dataset.no = "7";
        expect(rowPostNo(row)).toBe("7");

        const other = document.createElement("tr");
        other.innerHTML = "<td class=\"gall_tit\"><a href=\"/board/view/?id=other&no=12\">t</a></td>";
        expect(rowPostNo(other)).toBeUndefined();
    });
});
