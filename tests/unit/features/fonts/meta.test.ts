import {describe, expect, it} from "vitest";

import fontsMeta, {fontFamilyOf} from "@/features/fonts/meta";

describe("fontFamilyOf", () => {
    it("이름마다 따옴표로 감싸고 sans-serif를 붙인다", () => {
        expect(fontFamilyOf("Pretendard, 맑은 고딕")).toBe("\"Pretendard\", \"맑은 고딕\", sans-serif");
    });

    it("빈칸이면 기본 폰트다", () => {
        expect(fontFamilyOf("  ")).toBe("\"Noto Sans CJK KR\", \"NanumGothic\", sans-serif");
    });

    it("일반 글꼴군 키워드는 그대로 두고 그것으로 끝나면 덧붙이지 않는다", () => {
        expect(fontFamilyOf("Arial, Serif")).toBe("\"Arial\", Serif");
        expect(fontFamilyOf("monospace")).toBe("monospace");
    });

    it("따옴표로 감싼 이름은 한 겹 벗겨 다시 감싸고, 감싼 키워드는 이름으로 본다", () => {
        expect(fontFamilyOf("'Nanum Gothic', \"serif\"")).toBe("\"Nanum Gothic\", \"serif\", sans-serif");
    });

    it("입력이 CSS 규칙으로 새지 않는다", () => {
        expect(fontFamilyOf("a\"; } body { display: none } x {\"")).toBe("\"a\\\"; } body { display: none } x {\\\"\", sans-serif");
        expect(fontFamilyOf("a\\")).toBe("\"a\\\\\", sans-serif");
        expect(fontFamilyOf("A\nB")).toBe("\"AB\", sans-serif");
    });

    it("빈 항목은 건너뛴다", () => {
        expect(fontFamilyOf("A,, ,B")).toBe("\"A\", \"B\", sans-serif");
    });
});

describe("extensionPageVars", () => {
    it("옵션·팝업에 같은 폰트를 넘긴다", () => {
        expect(fontsMeta.extensionPageVars?.({customFonts: "A", changeDCFont: true, bodyFontSize: 13})).toEqual({"--refresher-font": "\"A\", sans-serif"});
    });
});
