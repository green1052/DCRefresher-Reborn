import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";

// overlay.css가 Tailwind 스캔에서 뺀 부품. 오버레이 코드가 이 부품을 쓰면 스타일이 경고 없이 빠진다.
// Vitest는 CSS를 ?raw로도 빈 문자열로 바꾸므로 파일을 직접 읽는다 (경로는 프로젝트 루트 기준).
const overlayCss = readFileSync("assets/styles/overlay.css", "utf8");
const excluded = /@source not "\.\.\/\.\.\/components\/ui\/\{([^}]+)\}\.tsx";/.exec(overlayCss)?.[1]?.split(",") ?? [];

// 옵션·팝업 밖에서 오버레이 CSS로 그려질 수 있는 소스.
const sources = import.meta.glob<string>([
    "../../../../{components,features,stores,core,utils}/**/*.{ts,tsx}",
    "../../../../entrypoints/content/**/*.{ts,tsx}"
], {query: "?raw", import: "default", eager: true});

describe("오버레이 CSS 스캔 제외", () => {
    it("옵션·팝업 밖의 소스는 뺀 부품과 옵션·팝업 폴더를 불러오지 않는다", () => {
        expect(excluded).toContain("card");
        expect(Object.keys(sources).length).toBeGreaterThan(0);
        const banned = new RegExp(`["']@/(components/ui/(${excluded.join("|")})|entrypoints/(options|popup))["'/]`);
        for (const [path, code] of Object.entries(sources)) {
            // 뺀 부품끼리는 서로 불러와도 된다.
            if (excluded.some((name) => path.endsWith(`/components/ui/${name}.tsx`))) continue;
            expect(banned.exec(code)?.[0], path).toBeUndefined();
        }
    });
});
