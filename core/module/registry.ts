import {addFilter} from "@/core/filtering";
import {moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import type {SettingValue} from "@/core/storage/types";

import {areEqual, isModuleEnabled, normalizeSettings} from "./settings";
import type {ModuleContext, ModuleDefinition} from "./types";

interface ModuleInstance {
    def: ModuleDefinition;
    settings: Record<string, SettingValue>;
    /** 실행 중일 때만 존재 */
    running?: { ctx: ModuleContext; controller: AbortController; api?: unknown };
}

const instances = new Map<string, ModuleInstance>();

const start = async (instance: ModuleInstance): Promise<void> => {
    if (instance.running) return;
    if (instance.def.urls && !instance.def.urls.some((re) => re.test(location.href))) return;

    // 이 실행의 수명. setup의 await 중에 중지(·재시작)되면 이미 끊겨 있어, 그 뒤 등록분은 바로 해제한다
    const controller = new AbortController();
    const {signal} = controller;
    const addCleanup = (dispose: () => void): void => {
        if (signal.aborted) dispose();
        else signal.addEventListener("abort", () => dispose(), {once: true});
    };
    const ctx: ModuleContext = {
        settings: instance.settings,
        signal,
        addFilter: (scope, callback) => {
            if (signal.aborted) return () => {};
            const dispose = addFilter(scope, callback);
            addCleanup(dispose);
            return dispose;
        },
        addCleanup
    };

    const running: NonNullable<ModuleInstance["running"]> = {ctx, controller};
    instance.running = running;

    try {
        const api = (await instance.def.setup(ctx)) ?? undefined;
        if (!signal.aborted) running.api = api;
    } catch (e) {
        // 실패한 모듈은 반쪽 상태로 두지 않는다 (그사이 새로 시작된 실행은 건드리지 않는다)
        if (!signal.aborted) stop(instance);
        throw e;
    }
};

/** keepDom이면 revoke 없이 리스너·타이머만 푼다. 해제는 revoke보다 먼저 — revoke가 던져도 리스너는 남지 않는다 */
const stop = (instance: ModuleInstance, keepDom = false): void => {
    const running = instance.running;
    if (!running) return;
    instance.running = undefined;

    running.controller.abort();
    if (!keepDom) instance.def.revoke?.();
};

/** 저장된 설정을 반영. 바뀐 값만 onChanged로 알린다 */
const applySettings = (instance: ModuleInstance, stored: Record<string, unknown> | null): void => {
    for (const [key, next] of Object.entries(normalizeSettings(instance.def, stored))) {
        if (areEqual(instance.settings[key], next)) continue;

        instance.settings[key] = next;
        if (instance.running) instance.def.onChanged?.(instance.running.ctx, key);
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

/** 실행 중인 모듈의 api (setup()의 리턴값). 꺼져 있거나 이 페이지에서 안 돌면 undefined */
export const getModuleApi = (id: string): unknown => instances.get(id)?.running?.api;

/** 단축키 실행 (배경의 commands → 탭). 실행 중인 모듈의 shortcuts만 */
export const runShortcut = (command: string): void => {
    for (const {def, running} of instances.values()) {
        const shortcut = def.shortcuts?.[command];
        if (shortcut && running) void shortcut(running.ctx, running.api);
    }
};

/**
 * 모든 모듈 중지 (콘텐츠 스크립트 컨텍스트가 무효화됐을 때). 해제 함수가 던져도 abort 리스너라 나머지는 돈다.
 * revoke는 부르지 않고 페이지를 지금 모습대로 둔다 — 확장을 업데이트하면 열린 탭마다 차단·스텔스·레이아웃이 풀려 새로고침 전까지 가린 것이 드러났다
 */
export const stopAll = (): void => {
    for (const instance of instances.values()) stop(instance, true);
};

/** 모듈을 일괄 등록하고, 옵션 페이지의 on/off(저장소)를 감시해 시작/중지한다 */
export const loadAll = async (defs: ModuleDefinition[]): Promise<void> => {
    const enables = await modulesStorage.getValue();

    const results = await Promise.allSettled(defs.map((def) => register(def, isModuleEnabled(def, enables))));
    for (const [index, result] of results.entries()) {
        if (result.status === "rejected") console.error(`Failed to load module: ${defs[index]?.id}`, result.reason);
    }

    modulesStorage.watch((next) => {
        for (const instance of instances.values()) {
            if (isModuleEnabled(instance.def, next)) void start(instance).catch((e) => console.error(e));
            else stop(instance);
        }
    });
};
