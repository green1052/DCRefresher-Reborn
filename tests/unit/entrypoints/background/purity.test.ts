// @vitest-environment node
import {globSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {expect, it} from "vitest";

/**
 * 배경 번들은 react·preact·zustand의 React 바인딩을 불러오지 않는다 (entrypoints/background/blocks.ts의 주석 —
 * zustand 본체는 React 바인딩을 딸려 보내 Preact까지 끌어온다). core가 stores를 불러오는 순간 조용히 깨지므로,
 * 배경 시작 파일에서 닿는 모든 모듈(동적 import와 import.meta.glob이 붙잡는 파일까지)의 import를 훑어 잡는다.
 * zustand/vanilla·zustand/shallow는 React가 없어 허용한다 (core/database.ts가 이미 쓴다).
 */
const BANNED = [/^react(-dom)?(\/.*)?$/, /^preact(\/.*)?$/, /^zustand$/, /^zustand\/react(\/.*)?$/];

const source = (file: string): string => {
    try {
        return readFileSync(file, "utf8");
    } catch {
        return "";
    }
};

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const resolveLocal = (from: string, specifier: string): string | null => {
    const base = specifier.startsWith("@/") ? join(process.cwd(), specifier.slice(2)) : resolve(dirname(from), specifier);
    for (const extension of EXTENSIONS) if (source(base + extension) !== "") return base + extension;
    return null;
};

// import.meta.glob의 패턴을 파일 목록으로 펼친다. 배경의 "../../features/*/background.ts"처럼 폴더 자리의 *도 펼친다.
const expandGlob = (from: string, pattern: string): string[] =>
    globSync(pattern, {cwd: dirname(from)}).map((file) => resolve(dirname(from), file));

it("배경 시작 파일에서 닿는 모듈은 react·preact·zustand를 불러오지 않는다", () => {
    const visited = new Set<string>();
    const packages = new Set<string>();
    const queue = [resolve(process.cwd(), "entrypoints/background/index.ts")];

    while (queue.length > 0) {
        const file = queue.pop()!;
        if (visited.has(file)) continue;
        visited.add(file);
        // 번들에서 지워지는 type import는 잡지 않는다 (lucide-react의 LucideIcon 타입 등).
        const code = source(file).replace(/^[ \t]*(?:import|export) type .*$/gm, "");
        for (const [, from, dynamic, glob] of code.matchAll(/from ["']([^"']+)["']|import\(\s*["']([^"']+)["']|import\.meta\.glob[^"']*["']([^"']+)["']/g)) {
            const specifier = from ?? dynamic;
            if (specifier !== undefined) {
                const local = resolveLocal(file, specifier);
                if (local) queue.push(local);
                else packages.add(specifier);
            } else if (glob !== undefined) queue.push(...expandGlob(file, glob));
        }
    }

    const banned = [...packages].filter((specifier) => BANNED.some((pattern) => pattern.test(specifier)));
    expect(banned).toEqual([]);
    // 훑은 파일이 없으면 통과한 것과 같으니 최소 한 파일은 닿았는지도 본다.
    expect(visited.size).toBeGreaterThan(5);
    // import.meta.glob이 붙잡는 기능별 배경 파일까지 닿았는지 본다.
    expect(visited).toContain(resolve(process.cwd(), "features/block/background.ts"));
});
