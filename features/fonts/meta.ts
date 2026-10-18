import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext, SettingsSchema} from "@/core/module/types";

const DEFAULT_FONTS = "Noto Sans CJK KR, NanumGothic";

/** CSS 일반 글꼴군 — 따옴표로 감싸면 키워드가 아니라 그 이름의 폰트로 해석된다. */
const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "math", "emoji", "fangsong", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded"]);

/**
 * "A, B" → `"A", "B", sans-serif`. 이름마다 따옴표로 감싸 입력이 CSS 규칙으로 새어 나가지 않게 한다.
 * 정확히 일치하는 일반 글꼴군 키워드만 그대로 두고, 이미 일반 글꼴군으로 끝나면 sans-serif를 붙이지 않는다.
 */
const toFontFamily = (value: string): string => {
    const fonts = value
        // 제어문자(줄바꿈 등)는 CSS 문자열을 끝내 뒷부분이 규칙으로 읽힌다.
        .replace(/\p{Cc}/gu, "")
        .split(",")
        .map((font) => font.trim())
        .filter(Boolean)
        .map((font) => {
            // 이미 따옴표로 감싼 이름은 한 겹 벗겨 다시 감싼다 (감싼 일반 글꼴군은 이름 그대로).
            const quoted = /^(["'])(.*)\1$/.exec(font)?.[2];
            return quoted === undefined && GENERIC_FAMILIES.has(font.toLowerCase()) ? font : `"${(quoted ?? font).replace(/["\\]/g, "\\$&")}"`;
        });

    if (!GENERIC_FAMILIES.has(fonts.at(-1)?.toLowerCase() ?? "")) fonts.push("sans-serif");
    return fonts.join(", ");
};

/** customFonts 설정값 → font-family (빈칸이면 기본 폰트). 디시 페이지(index.ts)와 옵션·팝업(extensionPageVars)이 같이 쓴다. */
export const fontFamilyOf = (customFonts: string): string => toFontFamily(customFonts.trim() || DEFAULT_FONTS);

export const settings = {
    customFonts: {type: "text", default: DEFAULT_FONTS},
    changeDCFont: {type: "check", default: true},
    bodyFontSize: {type: "range", default: 13, min: 5, max: 30, step: 1, unit: "px"}
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;

export default defineModuleMeta({
    id: "fonts",
    settings,

    // 옵션·팝업도 같은 폰트로 (assets/styles/tailwind.css의 --font-sans가 --refresher-font를 쓴다).
    extensionPageVars: (settings) => ({"--refresher-font": fontFamilyOf(settings.customFonts)})
});
