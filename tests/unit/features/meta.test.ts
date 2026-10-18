import {existsSync, readFileSync, statSync} from "node:fs";
import {dirname, join} from "node:path";

import {describe, expect, it} from "vitest";

import {defaultValue, normalizeSetting, settingsOf} from "@/core/module/settings";
import features from "@/features/index";
import metas from "@/features/meta";

/** 폴더 이름 → 메타 id. 저장소 키와 빌드(modules/commands)가 폴더·id를 같은 것으로 본다. */
const folders = Object.entries(import.meta.glob<{ default: { id: string } }>("../../../features/*/meta.ts", {eager: true}))
    .map(([path, module]) => [/features\/([^/]+)\/meta\.ts$/.exec(path)?.[1], module.default.id]);

describe("모듈 메타", () => {
    it("id는 폴더 이름과 같고 겹치지 않는다", () => {
        expect(folders.length).toBeGreaterThan(0);
        for (const [folder, id] of folders) expect(id).toBe(folder);
        const ids = metas.map((meta) => meta.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toEqual([...ids].sort());
    });

    it("모듈(index.ts)은 같은 순서로 자기 메타를 그대로 펼친다", () => {
        const byId = new Map(metas.map((meta) => [meta.id, meta]));
        const ids = features.map((module) => module.id);
        expect(ids).toEqual(metas.map((meta) => meta.id).filter((id) => ids.includes(id)));
        for (const module of features) {
            const meta = byId.get(module.id);
            expect(meta, module.id).toBeDefined();
            for (const key of ["name", "description", "urls", "defaultEnable", "settings", "toggles", "commands"] as const) {
                expect(module[key], `${module.id}.${key}`).toBe(meta?.[key]);
            }
        }
    });

    it("페이지에서 할 일이 없는 모듈만 index.ts가 없다", () => {
        const withIndex = new Set(features.map((module) => module.id));
        expect(metas.filter((meta) => !withIndex.has(meta.id)).map((meta) => meta.id)).toEqual(["imagesearch"]);
    });
});

describe("단축키", () => {
    const commands = metas.flatMap((meta) => Object.entries(meta.commands ?? {}).map(([name, command]) => ({module: meta.id, name, ...command})));

    it("명령 이름은 모듈을 통틀어 겹치지 않는다", () => {
        const names = commands.map((command) => command.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it("메타의 명령마다 index.ts에 동작이 있고, 동작마다 명령이 있다", () => {
        for (const module of features) {
            expect(Object.keys(module.shortcuts ?? {}).sort(), module.id).toEqual(Object.keys(module.commands ?? {}).sort());
        }
    });

    it("기본 키는 Ctrl·Alt를 포함한 브라우저 단축키 형식이고 겹치지 않는다", () => {
        const keys = commands.flatMap((command) => (command.key ? [command.key] : []));
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
            expect(key).toMatch(/^(?:(?:Ctrl|Alt|Shift|MacCtrl|Command)\+)+[A-Z0-9]$/);
            expect(key).toMatch(/(?:^|\+)(?:Ctrl|Alt)\+/);
        }
        expect(new Set(keys).size).toBe(keys.length);
        // 크롬은 기본 키를 4개까지만 받는다. dev 빌드의 다시 불러오기 명령(wxt.config.ts dev.reloadCommand)이 한 자리를 쓴다.
        expect(keys.length).toBeLessThanOrEqual(3);
    });

    it("설명이 있다", () => {
        for (const command of commands) expect(command.description.trim(), `${command.module}.${command.name}`).not.toBe("");
    });
});

describe("팝업 토글", () => {
    it("메타의 토글마다 index.ts가 같은 표시 정보로 동작을 붙인다", () => {
        for (const module of features) {
            const toggles = module.pageToggles ?? [];
            expect(toggles.map(({id, label}) => ({id, label})), module.id).toEqual(module.toggles ?? []);
            expect(new Set(toggles.map((toggle) => toggle.id)).size).toBe(toggles.length);
        }
    });
});

describe("아이콘", () => {
    it("모듈마다 icons.ts가 있다", () => {
        // 토글마다 아이콘이 있는지는 icons.ts의 satisfies IconsOf가 본다. 파일이 없으면 features/meta.ts가 기본 아이콘을 쓴다.
        const icons = Object.keys(import.meta.glob("/features/*/icons.ts")).map((path) => path.replace(/icons\.ts$/, "meta.ts"));
        expect(icons).toEqual(Object.keys(import.meta.glob("/features/*/meta.ts")));
    });

    it("meta.ts는 UI(lucide·Preact·React)를 불러오지 않는다", () => {
        // 배경·콘텐츠 번들이 meta.ts를 불러온다. 거기서 UI로 이어지면 lucide·Preact가 배경 번들에 딸려 간다.
        // 값으로 불러오는 것(import type 제외)을 프로젝트 안에서 따라가며 본다.
        const root = process.cwd();
        const resolveImport = (from: string, specifier: string): string | undefined => {
            const base = specifier.startsWith("@/") ? join(root, specifier.slice(2)) : specifier.startsWith(".") ? join(dirname(from), specifier) : undefined;
            return base && ["", ".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find((file) => existsSync(file) && statSync(file).isFile());
        };
        const reachesUi = (file: string, seen: Set<string>): string | undefined => {
            if (seen.has(file)) return undefined;
            seen.add(file);
            for (const [, specifier = ""] of readFileSync(file, "utf8").matchAll(/^(?:import|export)\s+(?!type\b)(?:[^;]*?\bfrom\s+)?"([^"]+)"/gm)) {
                // zustand 기본 진입점은 React 훅(create)이라 Preact를 끌고 온다. zustand/vanilla는 괜찮다.
                if (/^(?:lucide-react|preact|react|react-dom)(?:\/|$)|^zustand$/.test(specifier)) return `${file} → ${specifier}`;
                const next = resolveImport(file, specifier);
                const found = next && reachesUi(next, seen);
                if (found) return found;
            }
            return undefined;
        };

        const files = Object.keys(import.meta.glob("/features/*/meta.ts"));
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) expect(reachesUi(join(root, file), new Set())).toBeUndefined();
    });

});

describe("설정 스키마", () => {
    const schemas = metas.flatMap((meta) => Object.entries(meta.settings ?? {}).map(([key, schema]) => ({id: `${meta.id}.${key}`, schema})));

    it("기본값은 스키마에 맞는 값 그대로다", () => {
        for (const {id, schema} of schemas) expect(normalizeSetting(schema, defaultValue(schema)), id).toEqual(schema.default);
    });

    it("범위는 min ≤ 기본값 ≤ max이고 step이 양수다", () => {
        for (const {id, schema} of schemas) {
            if (schema.type !== "range") continue;
            expect(schema.min, id).toBeLessThanOrEqual(schema.default);
            expect(schema.default, id).toBeLessThanOrEqual(schema.max);
            expect(schema.step, id).toBeGreaterThan(0);
        }
    });

    it("이름과 설명이 있다", () => {
        for (const {id, schema} of schemas) {
            expect(schema.name.trim(), id).not.toBe("");
            expect(schema.desc.trim(), id).not.toBe("");
        }
    });

    it("확장 페이지 변수는 CSS 변수 이름이다", () => {
        for (const meta of metas) {
            if (!meta.extensionPageVars) continue;
            for (const name of Object.keys(meta.extensionPageVars(settingsOf(meta, null)))) expect(name).toMatch(/^--[a-z-]+$/);
        }
    });
});
