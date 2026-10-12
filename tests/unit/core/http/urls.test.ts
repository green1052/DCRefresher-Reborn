import {describe, expect, it} from "vitest";

import {dcinsideHref, galleryKind} from "@/core/http/urls";

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
