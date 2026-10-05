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
            for (const key of ["name", "description", "icon", "urls", "defaultEnable", "settings", "toggles", "commands"] as const) {
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
    });

    it("설명이 있다", () => {
        for (const command of commands) expect(command.description.trim(), `${command.module}.${command.name}`).not.toBe("");
    });
});

describe("팝업 토글", () => {
    it("메타의 토글마다 index.ts가 같은 표시 정보로 동작을 붙인다", () => {
        for (const module of features) {
            const toggles = module.pageToggles ?? [];
            expect(toggles.map(({id, label, icon}) => ({id, label, icon})), module.id).toEqual(module.toggles ?? []);
            expect(new Set(toggles.map((toggle) => toggle.id)).size).toBe(toggles.length);
        }
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
