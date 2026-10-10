import {describe, expect, it} from "vitest";

import {dcinsideHref} from "@/core/http/urls";

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
