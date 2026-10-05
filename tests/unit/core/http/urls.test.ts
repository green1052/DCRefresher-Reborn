import {afterEach, describe, expect, it, vi} from "vitest";

import {dcinsideHref, galleryKind, galleryPath, galltypeOf, listUrl, mergeParamURL, postSearchUrl, queryString, rowPostNo} from "@/core/http/urls";

afterEach(() => {
    history.replaceState(null, "", "/");
});

describe("dcinsideHref", () => {
    it("https 디시 주소만 돌려준다", () => {
        expect(dcinsideHref("https://gall.dcinside.com/board/view?id=a&no=1")).toBe("https://gall.dcinside.com/board/view?id=a&no=1");
        expect(dcinsideHref(new URL("https://m.dcinside.com/"))).toBe("https://m.dcinside.com/");
        for (const url of ["http://gall.dcinside.com/", "javascript:alert(1)", "https://evildcinside.com/", "https://dcinside.com.evil.com/", "/board/view", "", null, undefined]) {
            expect(dcinsideHref(url)).toBeUndefined();
        }
    });
});

describe("갤러리 종류", () => {
    it("주소에서 종류·경로·_GALLTYPE_을 읽는다", () => {
        const cases = [
            ["https://gall.dcinside.com/board/lists?id=a", "normal", "", "G"],
            ["https://gall.dcinside.com/mgallery/board/lists?id=a", "minor", "mgallery/", "M"],
            ["https://gall.dcinside.com/mini/board/view?id=a&no=1", "mini", "mini/", "MI"],
            ["https://gall.dcinside.com/person/board/lists?id=a", "person", "person/", "PR"]
        ];
        for (const [url, kind, path, galltype] of cases) {
            expect([galleryKind(url!), galleryPath(url!), galltypeOf(url!)]).toEqual([kind, path, galltype]);
        }
    });
});

describe("listUrl", () => {
    it("글 주소와 목록 주소가 같은 목록 주소가 된다", () => {
        const expected = "https://gall.dcinside.com/mgallery/board/lists?exception_mode=recommend&id=a";
        expect(listUrl("https://gall.dcinside.com/mgallery/board/view/?id=a&no=5&t=cv&exception_mode=recommend&page=1")).toBe(expected);
        expect(listUrl("https://gall.dcinside.com/mgallery/board/lists/?exception_mode=recommend&id=a")).toBe(expected);
    });

    it("1이 아닌 페이지는 남긴다", () => {
        expect(listUrl("https://gall.dcinside.com/board/lists/?id=a&page=2")).toBe("https://gall.dcinside.com/board/lists?id=a&page=2");
    });
});

describe("mergeParamURL", () => {
    it("원래 쿼리에 새 쿼리를 덮어쓴다", () => {
        expect(mergeParamURL("https://x.com/?id=a&page=1&s=1", "https://x.com/?page=3&q=b")).toBe("?id=a&page=3&s=1&q=b");
    });
});

describe("postSearchUrl", () => {
    it("검색어의 UTF-8 바이트를 .XX로 쓴다", () => {
        expect(postSearchUrl("a/b")).toBe("https://search.dcinside.com/post/sort/latest/q/.61.2F.62");
        expect(postSearchUrl("가")).toBe("https://search.dcinside.com/post/sort/latest/q/.EA.B0.80");
    });
});

describe("queryString / rowPostNo", () => {
    const row = (markup: string): HTMLElement => {
        const body = document.createElement("tbody");
        body.innerHTML = markup;
        return body.querySelector("tr")!;
    };

    it("지금 주소의 쿼리를 읽는다", () => {
        history.replaceState(null, "", "/board/view/?id=test&no=3");
        expect(queryString("no")).toBe("3");
        expect(queryString("page")).toBeNull();
    });

    it("data-no가 있으면 그것을 쓴다", () => {
        expect(rowPostNo(row("<tr data-no='7'><td class='gall_tit'><a href='/board/view/?id=b&no=9'></a></td></tr>"))).toBe("7");
    });

    it("data-no가 없으면 같은 갤러리 제목 링크의 no를 쓴다", () => {
        history.replaceState(null, "", "/board/view/?id=test&no=3");
        expect(rowPostNo(row("<tr><td class='gall_tit'><a href='/board/view/?id=test&no=9'></a></td></tr>"))).toBe("9");
        expect(rowPostNo(row("<tr><td class='gall_tit'><a href='/board/view/?id=other&no=9'></a></td></tr>"))).toBeUndefined();
        expect(rowPostNo(row("<tr><td class='gall_tit'><a href='/board/view/?id=test'></a></td></tr>"))).toBeUndefined();
        expect(rowPostNo(row("<tr><td>AD</td></tr>"))).toBeUndefined();
    });
});

describe("documentUrl", () => {
    const load = async (navigation: string | undefined): Promise<typeof import("@/core/http/urls")> => {
        vi.spyOn(performance, "getEntriesByType").mockReturnValue(navigation === undefined ? [] : [performance.mark(navigation)]);
        vi.resetModules();
        return import("@/core/http/urls");
    };

    it("pushState로 바뀐 주소가 아니라 문서를 불러온 주소를 쓴다", async () => {
        history.replaceState(null, "", "/board/lists/?id=test");
        const {documentUrl, isViewPage, pagePostNo} = await load("https://gall.dcinside.com/board/view/?id=test&no=5");
        expect(documentUrl.href).toBe("https://gall.dcinside.com/board/view/?id=test&no=5");
        expect(isViewPage).toBe(true);
        expect(pagePostNo).toBe("5");
    });

    it("항목 이름이 URL이 아니거나 없으면 지금 주소를 쓴다", async () => {
        history.replaceState(null, "", "/board/lists/?id=test");
        // 파이어폭스 확장 페이지의 항목 이름은 "document"다.
        const named = await load("document");
        expect(named.documentUrl.href).toBe(location.href);
        expect(named.isViewPage).toBe(false);
        expect(named.pagePostNo).toBeNull();

        expect((await load(undefined)).documentUrl.href).toBe(location.href);
    });
});
