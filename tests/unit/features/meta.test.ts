import {describe, expect, it} from "vitest";

import type {BackgroundModule} from "@/core/module/background";
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

    it("배경 모듈(background.ts)은 메타와 id가 같고, apply가 있으면 설정 키·defaultEnable도 같다", () => {
        // 배경은 meta.ts를 불러오지 않으므로 값이 따로 적힌다. 설정·defaultEnable은 apply에 넘길 때만 쓴다.
        const backgrounds = Object.values(import.meta.glob<{ default: BackgroundModule }>("../../../features/*/background.ts", {eager: true}))
            .map((module) => module.default);
        const byId = new Map(metas.map((meta) => [meta.id, meta]));
        expect(backgrounds.length).toBeGreaterThan(0);
        for (const module of backgrounds) {
            const meta = byId.get(module.id);
            expect(meta, module.id).toBeDefined();
            if (!module.apply) continue;
            expect(Object.keys(module.settings ?? {}), module.id).toEqual(Object.keys(meta?.settings ?? {}));
            expect(module.defaultEnable, module.id).toBe(meta?.defaultEnable);
        }
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
    it("모듈마다 아이콘이 있고, 토글 아이콘은 메타의 토글과 같은 id다", () => {
        for (const meta of metas) {
            expect(meta.icons.module, meta.id).toBeDefined();
            expect(Object.keys(meta.icons.toggles ?? {}).sort(), meta.id).toEqual((meta.toggles ?? []).map((toggle) => toggle.id).sort());
        }
    });

    it("콘텐츠 스크립트가 펼치는 메타(기본 export)에는 아이콘이 없다", () => {
        // 아이콘이 들어가면 lucide 아이콘이 content.js에 딸려 간다.
        for (const module of features) {
            expect(module, module.id).not.toHaveProperty("icons");
            expect(module, module.id).not.toHaveProperty("icon");
            for (const toggle of module.toggles ?? []) expect(toggle, `${module.id}.${toggle.id}`).not.toHaveProperty("icon");
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
