// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=9"}
import {describe, expect, it} from "vitest";

import {dcinsideHref, galleryKind, listUrl, rowPostNo} from "@/core/http/urls";

describe("dcinsideHref", () => {
    it.each(["https://gall.dcinside.com/board/view?id=a&no=1", "https://m.dcinside.com/", "https://dcimg5.dcinside.com/dccon.php?no=1"])("https 디시 주소 %s는 그대로 돌려준다", (url) => {
        expect(dcinsideHref(url)).toBe(url);
        expect(dcinsideHref(new URL(url))).toBe(url);
    });

    it.each([
        "http://gall.dcinside.com/",
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "https://evildcinside.com/",
        "https://dcinside.com.evil.com/",
        "https://evil.com/?https://gall.dcinside.com/",
        "https://gall.dcinside.com@evil.com/",
        "//evil.com/",
        "/board/view",
        "",
        null,
        undefined
    ])("%s는 돌려주지 않는다", (url) => {
        expect(dcinsideHref(url)).toBeUndefined();
    });
});

describe("galleryKind", () => {
    it("경로의 첫 칸으로 갤러리 종류를 본다", () => {
        expect(galleryKind("https://gall.dcinside.com/board/lists/?id=test")).toBe("normal");
        expect(galleryKind("https://gall.dcinside.com/mgallery/board/view/?id=test&no=1")).toBe("minor");
        expect(galleryKind("https://gall.dcinside.com/mini/board/lists/?id=test")).toBe("mini");
        expect(galleryKind("https://gall.dcinside.com/person/board/lists/?id=test")).toBe("person");
    });

    it("검색어에 든 갤러리 주소에는 걸리지 않는다", () => {
        expect(galleryKind("https://gall.dcinside.com/board/lists/?id=test&s_type=search_subject_memo&s_keyword=dcinside.com/mgallery/board")).toBe("normal");
    });
});

describe("listUrl", () => {
    it("글 주소에서 글 보기 값(no, t)과 page=1을 빼고 쿼리를 정렬한다", () => {
        expect(listUrl("https://gall.dcinside.com/board/view/?no=5&t=cv&page=1&id=test&s_type=search_all")).toBe("https://gall.dcinside.com/board/lists?id=test&s_type=search_all");
    });

    it("1이 아닌 page는 남긴다", () => {
        expect(listUrl("https://gall.dcinside.com/board/lists/?page=2&id=test")).toBe("https://gall.dcinside.com/board/lists?id=test&page=2");
    });

    it("마이너 갤러리는 경로 접두사를 붙인다", () => {
        expect(listUrl("https://gall.dcinside.com/mgallery/board/view/?id=minor&no=1")).toBe("https://gall.dcinside.com/mgallery/board/lists?id=minor");
    });

    it("같은 목록의 글 주소와 목록 주소는 같은 값이다", () => {
        expect(listUrl("https://gall.dcinside.com/board/view/?id=test&no=3&page=1")).toBe(listUrl("https://gall.dcinside.com/board/lists/?id=test"));
    });
});

describe("rowPostNo", () => {
    /** 목록 행. 제목 링크는 .gall_tit > a다. */
    const row = (href: string, no?: string): HTMLElement => {
        const element = document.createElement("tr");
        if (no) element.dataset.no = no;
        element.innerHTML = `<td class="gall_tit"><a href="${href}">제목</a></td>`;
        return element;
    };

    it("data-no가 있으면 그 값이다", () => {
        expect(rowPostNo(row("/board/view/?id=test&no=1", "7"))).toBe("7");
    });

    it("data-no가 없으면 같은 갤러리로 가는 제목 링크의 no다", () => {
        expect(rowPostNo(row("/board/view/?id=test&no=42"))).toBe("42");
    });

    it("다른 갤러리 링크나 no 없는 링크는 undefined다", () => {
        expect(rowPostNo(row("/board/view/?id=other&no=42"))).toBeUndefined();
        expect(rowPostNo(row("/board/lists/?id=test"))).toBeUndefined();
        expect(rowPostNo(document.createElement("tr"))).toBeUndefined();
    });
});
