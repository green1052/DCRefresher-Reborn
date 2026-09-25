import {eventBus} from "@/core/eventbus/bus";
import {addFilter} from "@/core/filtering";
import {moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import type {SettingValue} from "@/core/storage/types";

import {areEqual, normalizeSetting} from "./settings";
import type {ModuleContext, ModuleDefinition} from "./types";

interface ModuleInstance {
    def: ModuleDefinition;
    settings: Record<string, SettingValue>;
    /** 실행 중일 때만 존재 */
    running?: { ctx: ModuleContext; disposers: (() => void)[]; api?: unknown };
}

const instances = new Map<string, ModuleInstance>();

const isEnabled = (def: ModuleDefinition, enables: Record<string, boolean> | null): boolean =>
    enables?.[def.id] ?? def.defaultEnable ?? true;

const start = async (instance: ModuleInstance): Promise<void> => {
    if (instance.running) return;
    if (instance.def.urls && !instance.def.urls.some((re) => re.test(location.href))) return;

    const disposers: (() => void)[] = [];
    // setup의 await 중에 중지(·재시작)되면 이 실행은 끝났다 — stop이 이미 해제 목록을 돌았으니 그 뒤 등록분은 바로 해제한다
    const isCurrent = (): boolean => instance.running?.disposers === disposers;
    const ctx: ModuleContext = {
        settings: instance.settings,
        bus: eventBus,
        addFilter: (scope, callback) => {
            if (!isCurrent()) return () => {};
            const dispose = addFilter(scope, callback);
            disposers.push(dispose);
            return dispose;
        },
        addCleanup: (dispose) => {
            if (isCurrent()) disposers.push(dispose);
            else dispose();
        }
    };

    const running: NonNullable<ModuleInstance["running"]> = {ctx, disposers};
    instance.running = running;

    try {
        const api = (await instance.def.setup(ctx)) ?? undefined;
        if (isCurrent()) running.api = api;
    } catch (e) {
        // 실패한 모듈은 반쪽 상태로 두지 않는다 (그사이 새로 시작된 실행은 건드리지 않는다)
        if (isCurrent()) stop(instance);
        throw e;
    }
};

const stop = (instance: ModuleInstance): void => {
    const running = instance.running;
    if (!running) return;
    instance.running = undefined;

    instance.def.revoke?.(running.ctx);
    for (const dispose of running.disposers) dispose();
};

/** 저장된 설정을 반영. 바뀐 값만 onChanged로 알린다 */
const applySettings = (instance: ModuleInstance, stored: Record<string, unknown> | null): void => {
    for (const [key, schema] of Object.entries(instance.def.settings ?? {})) {
        const next = normalizeSetting(schema, stored?.[key]);
        if (areEqual(instance.settings[key], next)) continue;

        instance.settings[key] = next;
        if (instance.running) instance.def.onChanged?.(instance.running.ctx, key, next);
    }
};

const register = async (def: ModuleDefinition, enable: boolean): Promise<void> => {
    if (instances.has(def.id)) throw new Error(`${def.id} is already registered.`);

    const instance: ModuleInstance = {def, settings: {}};
    instances.set(def.id, instance);

    // 설정은 옵션 페이지가 저장소에 직접 쓰고, 여기서 감시해 반영한다
    if (def.settings) {
        const settingsItem = moduleSettingsStorage(def.id);
        applySettings(instance, await settingsItem.getValue());
        settingsItem.watch((next) => applySettings(instance, next));
    }

    if (enable) await start(instance);
};

/** 단축키 실행 (배경의 commands → 탭). 실행 중인 모듈의 shortcuts만 */
export const runShortcut = (command: string): void => {
    for (const {def, running} of instances.values()) {
        const shortcut = def.shortcuts?.[command];
        if (shortcut && running) void shortcut(running.ctx, running.api);
    }
};

/** 모든 모듈 중지 (콘텐츠 스크립트 컨텍스트가 무효화됐을 때) — 한 모듈이 실패해도 나머지는 멈춘다 */
export const stopAll = (): void => {
    for (const instance of instances.values()) {
        try {
            stop(instance);
        } catch (e) {
            console.error(e);
        }
    }
};

/** 모듈을 일괄 등록하고, 옵션 페이지의 on/off(저장소)를 감시해 시작/중지한다 */
export const loadAll = async (defs: ModuleDefinition[]): Promise<void> => {
    const enables = await modulesStorage.getValue();

    const results = await Promise.allSettled(defs.map((def) => register(def, isEnabled(def, enables))));
    for (const [index, result] of results.entries()) {
        if (result.status === "rejected") console.error(`Failed to load module: ${defs[index]?.id}`, result.reason);
    }

    modulesStorage.watch((next) => {
        for (const instance of instances.values()) {
            if (isEnabled(instance.def, next)) void start(instance).catch((e) => console.error(e));
            else stop(instance);
        }
    });
};
