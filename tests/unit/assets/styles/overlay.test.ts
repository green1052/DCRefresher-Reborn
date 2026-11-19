import {describe, expect, it} from "vitest";

// 옵션, 팝업 밖에서 오버레이 CSS로 그려질 수 있는 소스.
const sources = import.meta.glob<string>([
    "../../../../{components,features,stores,core,utils}/**/*.{ts,tsx}",
    "../../../../entrypoints/content/**/*.{ts,tsx}"
], {query: "?raw", import: "default", eager: true});

// 오버레이 CSS는 옵션, 팝업 폴더를 스캔에서 뺀다(overlay.css의 @source not). 오버레이 코드가 그쪽을 불러오면 스타일이 경고 없이 빠진다.
describe("오버레이 CSS 스캔 제외", () => {
    it("옵션, 팝업 밖의 소스는 옵션, 팝업 폴더를 불러오지 않는다", () => {
        expect(Object.keys(sources).length).toBeGreaterThan(0);
        const banned = /["']@\/entrypoints\/(?:options|popup)["'/]/;
        for (const [path, code] of Object.entries(sources)) {
            expect(banned.exec(code)?.[0], path).toBeUndefined();
        }
    });
});
