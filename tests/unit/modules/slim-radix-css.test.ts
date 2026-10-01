import {describe, expect, it} from "vitest";

import {isUsedClass, slim, type Usage, usedVariants} from "../../../modules/slim-radix-css";

const usage = (overrides: Partial<Usage> = {}): Usage => ({
    literals: new Set(["rt-Button", "rt-BaseButton", "rt-r-size", "rt-r-w", "rt-r-m", "rt-variant-", "rt-Text"]),
    breakpoints: new Set(["md"]),
    variants: new Set(["solid", "soft"]),
    defaults: new Map(),
    overlay: false,
    ...overrides
});

const css = [
    ":root,.light{--gray-1:#fcfcfc;--blue-1:#fbfdff;--default-font-family:\"Segoe UI (Custom)\";--code-font-family:\"Consolas (Custom)\"}",
    "@font-face{font-family:\"Segoe UI (Custom)\";src:local(Segoe UI)}",
    "@font-face{font-family:\"Consolas (Custom)\";src:local(Consolas)}",
    ".rt-Button,.rt-Inset{display:flex}",
    ".rt-Button:where(.rt-r-size-2){height:32px}",
    ".rt-Button:where(.rt-variant-soft){background:red}",
    ".rt-Button:where(.rt-variant-classic){background:blue}",
    ".rt-Text{color:red}",
    ".rt-r-w{width:var(--width)}",
    ".-rt-r-m-1{margin:-4px}",
    "@media (min-width:768px){.sm\\:rt-r-w{width:var(--width-sm)}}",
    "@media (min-width:1024px){.md\\:rt-r-w{width:var(--width-md)}.md\\:rt-r-size-1{height:1px}}",
    "[data-accent-color=blue]{--accent-1:var(--blue-1)}",
    "[data-accent-color=crimson]{--accent-1:var(--crimson-1)}",
    ".radix-themes:where([data-gray-color=mauve]){--gray-1:var(--mauve-1)}",
    "@keyframes rt-fade{from{opacity:0}to{opacity:1}}"
].join("");

describe("isUsedClass", () => {
    it("이름 그대로거나 값이 붙는 접두어가 JS에 있으면 쓰는 클래스다", () => {
        const literals = new Set(["rt-r-size", "rt-variant-", "rt-Button"]);
        expect(isUsedClass("rt-Button", literals)).toBe(true);
        expect(isUsedClass("rt-r-size-2", literals)).toBe(true);
        expect(isUsedClass("rt-variant-soft", literals)).toBe(true);
        expect(isUsedClass("rt-ButtonInner", literals)).toBe(false);
        expect(isUsedClass("rt-r-size2", literals)).toBe(false);
        expect(isUsedClass("rt-Inset", literals)).toBe(false);
    });
});

describe("slim", () => {
    it("JS에 없는 컴포넌트·variant·브레이크포인트·색 규칙과 안 쓰는 글꼴을 뺀다", () => {
        const out = slim(css, usage());
        expect(out).toContain(".rt-Button{display:flex}");
        expect(out).not.toContain("rt-Inset");
        expect(out).toContain(".rt-Button:where(.rt-r-size-2)");
        expect(out).toContain("rt-variant-soft");
        expect(out).not.toContain("rt-variant-classic");
        expect(out).toContain(".rt-Text{color:red}");
        expect(out).toContain(".-rt-r-m-1");
        expect(out).not.toContain("min-width:768px");
        expect(out).toContain(".md\\:rt-r-w");
        expect(out).toContain(".md\\:rt-r-size-1");
        expect(out).toContain("[data-accent-color=blue]");
        expect(out).not.toContain("crimson");
        expect(out).not.toContain("mauve");
        expect(out).toContain("@keyframes rt-fade");
        // 기본 글꼴(우리가 덮어쓴다)만 쓰는 Segoe UI는 빠지고, --code-font-family가 쓰는 Consolas는 남는다.
        expect(out).not.toContain("Segoe UI (Custom)\";src");
        expect(out).toContain("font-family:\"Consolas (Custom)\";src");
    });

    it("오버레이는 @font-face를 모두 빼고, 브레이크포인트를 안 쓰면 반응형 블록이 통째로 빠진다", () => {
        const out = slim(css, usage({overlay: true, breakpoints: new Set()}));
        expect(out).not.toContain("@font-face");
        expect(out).not.toContain("@media");
    });
});

describe("usedVariants", () => {
    it("소스의 variant 문자열과 Radix 기본값을 모으고, 값을 모르는 식이 있으면 모두 남긴다", () => {
        expect(usedVariants(`<Button variant="outline"/><Badge variant={on ? "solid" : "ghost"}/>`))
            .toEqual(new Set(["solid", "soft", "surface", "outline", "ghost"]));
        expect(usedVariants(`<Button variant={variant}/>`)).toBeNull();
    });

    it("컴포넌트 기본값은 그 컴포넌트 규칙에서만 남긴다", () => {
        const out = slim(`${css}.rt-Kbd:where(.rt-variant-classic){color:gray}`, usage({literals: new Set([...usage().literals, "rt-Kbd"]), defaults: new Map([["classic", ["rt-Kbd"]]])}));
        expect(out).toContain(".rt-Kbd:where(.rt-variant-classic)");
        expect(out).not.toContain(".rt-Button:where(.rt-variant-classic)");
    });

    it("값을 모르면(null) variant 규칙을 빼지 않는다", () => {
        const out = slim(css, usage({variants: null}));
        expect(out).toContain("rt-variant-classic");
        expect(out).toContain("rt-variant-soft");
    });
});
