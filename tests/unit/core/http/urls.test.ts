// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=9"}
import {describe, expect, it} from "vitest";

import {dcinsideHref, galleryKind, listUrl, managerAjaxUrl, mergeParamURL, postSearchUrl, rowPostNo} from "@/core/http/urls";

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

describe("managerAjaxUrl", () => {
    it("디시 get_gall_type_name()처럼 경로 첫 칸으로 관리 API 접두사를 정한다", () => {
        expect(managerAjaxUrl("https://gall.dcinside.com/mgallery/board/view/?id=test&no=1", "delete_list")).toBe("https://gall.dcinside.com/ajax/minor_manager_board_ajax/delete_list");
        expect(managerAjaxUrl("https://gall.dcinside.com/mini/board/view/?id=test&no=1", "delete_list")).toBe("https://gall.dcinside.com/ajax/mini_manager_board_ajax/delete_list");
        expect(managerAjaxUrl("https://gall.dcinside.com/person/board/view/?id=test&no=1", "delete_list")).toBe("https://gall.dcinside.com/ajax/person_manager_board_ajax/delete_list");
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

describe("mergeParamURL", () => {
    it("origin의 쿼리에 from의 쿼리를 덮어쓰고, from에 없는 값은 남긴다", () => {
        expect(mergeParamURL("https://gall.dcinside.com/board/view/?id=a&no=5&page=1", "https://gall.dcinside.com/board/lists/?id=a&page=2")).toBe("?id=a&no=5&page=2");
    });

    it("from에만 있는 값은 뒤에 붙인다", () => {
        expect(mergeParamURL("https://gall.dcinside.com/board/lists/?id=a", "https://gall.dcinside.com/board/lists/?s_type=search_all&s_keyword=%EA%B0%80")).toBe("?id=a&s_type=search_all&s_keyword=%EA%B0%80");
    });
});

describe("postSearchUrl", () => {
    it("검색어의 UTF-8 바이트를 대문자 \".XX\"로 쓴다", () => {
        expect(postSearchUrl("a/가")).toBe("https://search.dcinside.com/post/sort/latest/q/.61.2F.EA.B0.80");
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

    it("미리보기가 주소를 다른 갤러리 글로 바꿔도 이 문서의 갤러리로 고른다", () => {
        history.replaceState(null, "", "/board/view/?id=other&no=5");
        try {
            expect(rowPostNo(row("/board/view/?id=test&no=42"))).toBe("42");
            expect(rowPostNo(row("/board/view/?id=other&no=42"))).toBeUndefined();
        } finally {
            history.replaceState(null, "", "/board/view/?id=test&no=9");
        }
    });
});
