import {describe, expect, it} from "vitest";

// pages.css(옵션)는 미리보기 창 화면을 Tailwind 스캔에서 뺀다. 옵션이 그 화면을 쓰면 스타일이 경고 없이 빠진다.
// 팝업은 popup.css를 쓰고 popup.test.ts가 지킨다.
const sources = import.meta.glob<string>("../../../../entrypoints/options/**/*.{ts,tsx}", {query: "?raw", import: "default", eager: true});

describe("옵션 CSS 스캔 제외", () => {
    it("옵션은 미리보기 창 화면을 불러오지 않는다", () => {
        expect(Object.keys(sources).length).toBeGreaterThan(0);
        for (const [path, code] of Object.entries(sources)) expect(/["']@\/features\/preview\/ui[/"']/.exec(code)?.[0], path).toBeUndefined();
    });
});
