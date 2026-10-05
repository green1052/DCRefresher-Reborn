import {describe, expect, it} from "vitest";

import {IMAGE_SEARCH_ENGINES, IMAGE_SEARCH_SETTINGS, imageSearchUrl} from "@/features/imagesearch/engines";

describe("imageSearchUrl", () => {
    it("디시 본문 이미지는 dccon.php 주소로 바꿔 엔진 주소에 붙인다", () => {
        const src = "https://dcimg8.dcinside.co.kr/viewimage.php?id=abc&no=24b0d769&f=1";
        expect(imageSearchUrl("saucenao", src)).toBe(`https://saucenao.com/search.php?url=${encodeURIComponent("https://image.dcinside.com/dccon.php?id=abc&no=24b0d769&f=1")}`);
        expect(imageSearchUrl("ascii2d", src)).toMatch(/^https:\/\/ascii2d\.net\/search\/url\/https%3A%2F%2Fimage\.dcinside\.com%2Fdccon\.php%3F/);
    });

    it("모르는 엔진이나 본문 이미지가 아니면 null이다", () => {
        expect(imageSearchUrl("unknown", "https://dcimg8.dcinside.co.kr/viewimage.php?id=1")).toBeNull();
        expect(imageSearchUrl("saucenao", "https://example.com/a.png")).toBeNull();
        // 프로토타입 키를 엔진으로 보지 않는다.
        expect(imageSearchUrl("constructor", "https://dcimg8.dcinside.co.kr/viewimage.php?id=1")).toBeNull();
    });
});

describe("IMAGE_SEARCH_SETTINGS", () => {
    it("엔진마다 켜기 설정이 있고 SauceNao만 기본으로 켠다", () => {
        expect(Object.keys(IMAGE_SEARCH_SETTINGS)).toEqual(Object.keys(IMAGE_SEARCH_ENGINES));
        const enabled = Object.entries(IMAGE_SEARCH_SETTINGS).filter(([, schema]) => schema.default === true).map(([id]) => id);
        expect(enabled).toEqual(["saucenao"]);
    });
});
