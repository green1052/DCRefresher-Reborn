import {readFileSync} from "node:fs";
import {posix} from "node:path";

import {describe, expect, it} from "vitest";

// popup.css가 Tailwind 스캔에서 뺀 소스. 팝업이 그 안의 화면을 그리면 스타일이 경고 없이 빠진다.
// Vitest는 CSS를 ?raw로도 빈 문자열로 바꾸므로 파일을 직접 읽는다 (경로는 프로젝트 루트 기준).
const popupCss = readFileSync("assets/styles/popup.css", "utf8");
const excluded = [...popupCss.matchAll(/@source not "\.\.\/\.\.\/([^"]+)";/g)].flatMap((match) => match[1] ?? []);

const sources = Object.fromEntries(Object.entries(import.meta.glob<string>(
    "../../../../{components,core,entrypoints,features,stores,utils}/**/*.{ts,tsx}",
    {query: "?raw", import: "default", eager: true}
)).map(([path, code]) => [path.replace("../../../../", ""), code]));

/** 프로젝트 소스로 풀리는 import만 루트 기준 경로로 돌려준다 (패키지 import는 undefined). */
const resolve = (from: string, specifier: string): string | undefined => {
    const base = specifier.startsWith("@/") ? specifier.slice(2)
        : specifier.startsWith(".") ? posix.join(posix.dirname(from), specifier)
            : undefined;
    if (base === undefined) return undefined;
    return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((path) => path in sources);
};

/** 팝업 진입점에서 import를 따라 닿는 소스 전부. */
const reachable = (entry: string): Set<string> => {
    const seen = new Set([entry]);
    for (const path of seen) {
        for (const [, specifier = ""] of sources[path]?.matchAll(/(?:from|import)\s*["']([^"']+)["']/g) ?? []) {
            const next = resolve(path, specifier);
            if (next) seen.add(next);
        }
    }
    return seen;
};

describe("팝업 CSS 스캔 제외", () => {
    it("팝업이 그리는 화면(.tsx)은 스캔에서 뺀 소스가 아니다", () => {
        expect(excluded).toContain("{features,core,stores,components/overlay}");
        const reached = reachable("entrypoints/popup/main.tsx");
        expect(reached).toContain("components/ui/button.tsx");
        // 클래스는 화면(.tsx)에 있다. 팝업은 features·core·stores의 .ts(설정 메타·상태)만 불러온다.
        // 경로 패턴이 폴더면 그 안의 파일 전부가 빠진다.
        const hit = [...reached].filter((path) => path.endsWith(".tsx") &&
            excluded.some((pattern) => posix.matchesGlob(path, pattern) || posix.matchesGlob(path, `${pattern}/**`)));
        expect(hit).toEqual([]);
    });
});
