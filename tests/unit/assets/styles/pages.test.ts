import {describe, expect, it} from "vitest";

// pages.css(옵션·팝업)는 미리보기 창 화면을 Tailwind 스캔에서 뺀다. 옵션·팝업이 그 화면을 쓰면 스타일이 경고 없이 빠진다.
const sources = import.meta.glob<string>("../../../../entrypoints/{options,popup}/**/*.{ts,tsx}", {query: "?raw", import: "default", eager: true});

describe("옵션·팝업 CSS 스캔 제외", () => {
    it("옵션·팝업은 미리보기 창 화면을 불러오지 않는다", () => {
        expect(Object.keys(sources).length).toBeGreaterThan(0);
        for (const [path, code] of Object.entries(sources)) expect(/["']@\/features\/preview\/ui[/"']/.exec(code)?.[0], path).toBeUndefined();
    });
});
