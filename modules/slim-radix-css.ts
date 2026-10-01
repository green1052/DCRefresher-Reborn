import {existsSync, readFileSync} from "node:fs";

import postcss, {type AtRule, type Root} from "postcss";
import type {Plugin, Rollup} from "vite";
import {defineWxtModule} from "wxt/modules";

/**
 * Radix Themes CSS(components.css·utilities.css)에서 그 엔트리가 쓰지 않는 규칙을 뺀다.
 * 옵션·팝업·오버레이가 각각 다른 컴포넌트를 쓰는데, 통째로 넣으면 CSS가 엔트리마다 600KB에 이른다.
 *
 * 쓰는지는 손으로 적은 목록이 아니라 빌드 결과로 판단한다. Radix는 컴포넌트마다 `rt-Button`, `rt-r-size` 같은 클래스 이름을
 * JS 리터럴로 두므로(트리 셰이킹으로 쓰는 컴포넌트 것만 남는다), CSS 규칙의 `.rt-*` 클래스가 그 엔트리에서 닿는 JS 청크 어디에도 없으면 뺀다.
 * 값이 붙는 클래스(`rt-r-size-2`, `rt-variant-soft`)는 JS에 접두어(`rt-r-size`, `rt-variant-`)만 있으므로 접두어로 맞춘다.
 * 반응형 접두어(`md:rt-r-w`)는 소스에서 그 브레이크포인트({md: …})를 쓸 때만 남긴다.
 * 없는 색(`[data-accent-color=crimson]`)의 규칙과, 어느 엔트리도 쓰지 않는 Radix 글꼴의 @font-face도 뺀다.
 * 오버레이(콘텐츠 스크립트)는 @font-face를 모두 뺀다: 오버레이는 --default-font-family를 덮어쓰고, 두면 WXT가 shadow에서 떼어 디시 페이지의 head에 넣는다.
 *
 * generateBundle에서 돌아 CSS는 이미 압축된 상태다. 개발 서버(옵션·팝업 HMR)에서는 돌지 않아 CSS가 통째로 들어간다.
 */

type OutputChunk = Rollup.OutputChunk;

const BREAKPOINTS = ["xs", "sm", "md", "lg", "xl"] as const;
type Breakpoint = (typeof BREAKPOINTS)[number];

/** CSS 선택자 안의 `.rt-…` 클래스. 반응형 접두어는 `xs\:`로 이스케이프되어 있고, 음수 여백(`-rt-r-m-1`)은 앞에 -가 붙는다. */
const CLASS = /\.(?:(xs|sm|md|lg|xl)\\:)?-?(rt-[A-Za-z0-9-]+)/g;
/** JS 코드 안의 rt- 클래스 리터럴·접두어. */
const LITERAL = /rt-[A-Za-z0-9-]+/g;
const COLOR_ATTR = /\[data-(?:accent|gray)-color=([a-z]+)\]/;
/**
 * variant prop 값. `rt-variant-${variant}`로 붙어 JS만으로는 어느 값이 쓰이는지 모르므로 소스의 variant="…"에서 모은다.
 * 값을 주지 않은 컴포넌트는 Radix 기본값(solid·soft·surface 중 하나)을 쓴다. classic은 어느 컴포넌트의 기본값도 아니다.
 */
const DEFAULT_VARIANTS = ["solid", "soft", "surface"];

const uniqueBreakpoints = (text: string): Set<Breakpoint> => {
    const found = new Set<Breakpoint>();
    for (const match of text.matchAll(/\b(xs|sm|md|lg|xl)\s*:/g)) found.add(match[1] as Breakpoint);
    return found;
};

/** variant="soft"와 variant={cond ? "soft" : "solid"} 안의 문자열. */
const usedVariants = (text: string): Set<string> => {
    const found = new Set(DEFAULT_VARIANTS);
    for (const match of text.matchAll(/variant=(?:"(\w+)"|\{([^}]*)\})/g)) {
        if (match[1]) found.add(match[1]);
        for (const literal of (match[2] ?? "").matchAll(/"(\w+)"/g)) found.add(literal[1]!);
    }
    return found;
};

/** 엔트리 청크에서 정적·동적 import로 닿는 모든 청크. */
const reachableChunks = (entry: OutputChunk, chunks: Map<string, OutputChunk>): OutputChunk[] => {
    const seen = new Map<string, OutputChunk>();
    const queue = [entry];
    for (let chunk = queue.shift(); chunk; chunk = queue.shift()) {
        if (seen.has(chunk.fileName)) continue;
        seen.set(chunk.fileName, chunk);
        for (const name of [...chunk.imports, ...chunk.dynamicImports]) {
            const next = chunks.get(name);
            if (next) queue.push(next);
        }
    }
    return [...seen.values()];
};

export interface Usage {
    literals: Set<string>;
    breakpoints: Set<Breakpoint>;
    variants: Set<string>;
    /** 콘텐츠 스크립트(오버레이 shadow DOM)에 넣는 CSS인지. */
    overlay: boolean;
}

const usageOf = (entry: OutputChunk, chunks: Map<string, OutputChunk>, root: string): Usage => {
    const literals = new Set<string>();
    let source = "";
    for (const chunk of reachableChunks(entry, chunks)) {
        for (const match of chunk.code.matchAll(LITERAL)) literals.add(match[0]);
        // 반응형 prop은 우리 소스(.tsx)에서만 쓴다. Radix 자체 코드에는 브레이크포인트 이름이 모두 들어 있어 청크 코드로는 가릴 수 없다.
        for (const id of chunk.moduleIds) {
            const file = id.split("?")[0]!;
            if (!file.startsWith(root) || file.includes("/node_modules/") || !existsSync(file)) continue;
            source += readFileSync(file, "utf8");
        }
    }
    return {literals, breakpoints: uniqueBreakpoints(source), variants: usedVariants(source), overlay: entry.fileName.startsWith("content-scripts/")};
};

/** JS에 클래스 이름 그대로나, 값이 붙는 접두어(`rt-r-size` → `rt-r-size-2`, `rt-variant-` → `rt-variant-soft`)가 있는지. */
export const isUsedClass = (name: string, literals: Set<string>): boolean => {
    if (literals.has(name)) return true;
    for (let at = name.lastIndexOf("-"); at > 0; at = name.lastIndexOf("-", at - 1)) {
        if (literals.has(name.slice(0, at)) || literals.has(name.slice(0, at + 1))) return true;
    }
    return false;
};

export const slim = (css: string, usage: Usage): string => {
    const root: Root = postcss.parse(css);

    // 토큰이 정의된 색 (--blue-1 등). radix-themes.css가 가져온 색 스케일만 있다.
    const colors = new Set<string>();
    root.walkDecls(/^--([a-z]+)-1$/, (decl) => {
        colors.add(decl.prop.slice(2, -2));
    });

    const keepSelector = (selector: string): boolean => {
        const color = COLOR_ATTR.exec(selector)?.[1];
        if (color && color !== "auto" && !colors.has(color)) return false;

        for (const [, breakpoint, name] of selector.matchAll(CLASS)) {
            if (breakpoint && !usage.breakpoints.has(breakpoint as Breakpoint)) return false;
            const variant = /^rt-variant-(\w+)$/.exec(name!)?.[1];
            if (variant && !usage.variants.has(variant)) return false;
            if (!isUsedClass(name!, usage.literals)) return false;
        }
        return true;
    };

    root.walkRules((rule) => {
        if (rule.parent?.type === "atrule" && (rule.parent as AtRule).name === "keyframes") return;
        const selectors = rule.selectors.filter(keepSelector);
        if (selectors.length === 0) rule.remove();
        else if (selectors.length !== rule.selectors.length) rule.selectors = selectors;
    });

    // @font-face: 오버레이는 모두, 그 밖에는 기본 글꼴(--default-font-family, 우리가 덮어쓴다) 말고는 아무 데도 안 쓰는 글꼴을 뺀다.
    const referenced = new Set<string>();
    root.walkDecls((decl) => {
        if (decl.parent?.type === "atrule" && (decl.parent as AtRule).name === "font-face") return;
        if (decl.prop === "--default-font-family") return;
        for (const match of decl.value.matchAll(/"([^"]+)"/g)) referenced.add(match[1]!);
    });
    root.walkAtRules("font-face", (rule) => {
        let family = "";
        rule.walkDecls("font-family", (decl) => {
            family = decl.value.replace(/^"|"$/g, "");
        });
        if (usage.overlay || !referenced.has(family)) rule.remove();
    });

    // 빈 @media·@supports는 지운다.
    root.walkAtRules((rule) => {
        if (rule.nodes?.length === 0) rule.remove();
    });

    return root.toString();
};

const plugin = (root: string): Plugin => ({
    name: "refresher:slim-radix-css",
    enforce: "post",
    generateBundle(_options, bundle) {
        const chunks = new Map(Object.values(bundle).flatMap((output) => (output.type === "chunk" ? [[output.fileName, output] as const] : [])));

        for (const output of Object.values(bundle)) {
            if (output.type !== "asset" || !output.fileName.endsWith(".css") || typeof output.source !== "string") continue;
            if (!output.source.includes(".rt-")) continue;

            // 이 CSS를 쓰는 엔트리. 콘텐츠 스크립트(라이브러리 빌드)는 importedCss가 비어 있어 하나뿐인 청크로 본다.
            const entry = [...chunks.values()].find((chunk) => chunk.viteMetadata?.importedCss.has(output.fileName))
                ?? (chunks.size === 1 ? [...chunks.values()][0] : undefined);
            if (!entry?.isEntry) continue;

            const usage = usageOf(entry, chunks, root);
            const before = output.source.length;
            output.source = slim(output.source, usage);
            this.info(`${output.fileName}: ${Math.round(before / 1024)}KB → ${Math.round(output.source.length / 1024)}KB (Radix 클래스 ${usage.literals.size}개, 반응형 ${[...usage.breakpoints].join(",") || "없음"})`);
        }
    }
});

export default defineWxtModule((wxt) => {
    wxt.hook("vite:build:extendConfig", (_entries, config) => {
        config.plugins ??= [];
        config.plugins.push(plugin(wxt.config.root));
    });
});
