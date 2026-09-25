import {eventBus} from "@/core/eventbus/bus";
import {addFilter} from "@/core/filtering";
import {moduleDataStorage, moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import type {JsonValue, SettingValue} from "@/core/storage/types";

import {areEqual, normalizeSetting} from "./settings";
import type {ModuleContext, ModuleDefinition} from "./types";

interface ModuleInstance {
    def: ModuleDefinition;
    settings: Record<string, SettingValue>;
    data: Record<string, JsonValue>;
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
    const ctx: ModuleContext = {
        id: instance.def.id,
        settings: instance.settings,
        data: instance.data,
        bus: eventBus,
        addFilter: (scope, callback) => {
            const dispose = addFilter(scope, callback);
            disposers.push(dispose);
            return dispose;
        },
        addCleanup: (dispose) => {
            disposers.push(dispose);
        }
    };

    instance.running = {ctx, disposers};

    try {
        instance.running.api = (await instance.def.setup(ctx)) ?? undefined;
    } catch (error) {
        // 실패한 모듈은 반쪽 상태로 두지 않는다
        stop(instance);
        throw error;
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
        if (instance.running) instance.def.onChanged?.(key, next);
    }
};

/** 모듈 영속 데이터 — 속성을 바꾸면 바로 저장되는 Proxy */
const persistentData = async (id: string): Promise<Record<string, JsonValue>> => {
    const item = moduleDataStorage(id);
    const save = <T>(result: T, target: Record<string, JsonValue>): T => {
        void item.setValue(target);
        return result;
    };

    return new Proxy((await item.getValue()) ?? {}, {
        set: (target, property, value, receiver) => save(Reflect.set(target, property, value, receiver), target),
        deleteProperty: (target, property) => save(Reflect.deleteProperty(target, property), target)
    });
};

const register = async (def: ModuleDefinition, enable: boolean): Promise<void> => {
    if (instances.has(def.id)) throw new Error(`${def.id} is already registered.`);

    const instance: ModuleInstance = {def, settings: {}, data: await persistentData(def.id)};
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

/** 모듈을 일괄 등록하고, 옵션 페이지의 on/off(저장소)를 감시해 시작/중지한다 */
export const loadAll = async (defs: ModuleDefinition[]): Promise<void> => {
    const enables = await modulesStorage.getValue();

    const results = await Promise.allSettled(defs.map((def) => register(def, isEnabled(def, enables))));
    results.forEach((result, index) => {
        if (result.status === "rejected") console.error(`Failed to load module: ${defs[index]?.id}`, result.reason);
    });

    modulesStorage.watch((next) => {
        for (const instance of instances.values()) {
            if (isEnabled(instance.def, next)) void start(instance).catch((error) => console.error(error));
            else stop(instance);
        }
    });
};
