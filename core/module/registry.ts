import {addFilter} from "@/core/filtering";
import {eventBus} from "@/core/eventbus/bus";
import {moduleDataStorage, moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import type {JsonValue, SettingValue} from "@/core/storage/types";
import type {ModuleContext, ModuleDefinition, ModuleSchema, SettingSchema} from "./types";

interface ModuleInstance {
    def: ModuleDefinition;
    enable: boolean;
    running: boolean;
    settings: Record<string, SettingValue>;
    data: Record<string, JsonValue>;
    disposers: (() => void)[];
    ctx?: ModuleContext;
    api?: unknown;
}

const instances = new Map<string, ModuleInstance>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeSetting = (schema: SettingSchema, value: unknown): SettingValue => {
    switch (schema.type) {
        case "check":
            return typeof value === "boolean" ? value : schema.default;
        case "text":
        case "option":
            return typeof value === "string" ? value : schema.default;
        case "range":
            return typeof value === "number" && Number.isFinite(value)
                ? Math.min(schema.max, Math.max(schema.min, value))
                : schema.default;
        case "order": {
            const itemKeys = new Set(Object.keys(schema.items));
            const stored = (Array.isArray(value) ? value : schema.default).filter(
                (key): key is string => typeof key === "string" && itemKeys.has(key)
            );
            // 스키마에 새로 추가된 항목은 맨 뒤에 넣는다.
            for (const key of schema.default) {
                if (itemKeys.has(key) && !stored.includes(key)) stored.push(key);
            }
            return stored;
        }
    }
};

const areEqual = (a: SettingValue | undefined, b: SettingValue): boolean => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
    return false;
};

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
            const disposer = addFilter(scope, callback);
            disposers.push(disposer);
            return disposer;
        },
        addCleanup: (dispose: () => void) => {
            disposers.push(dispose);
        }
    };

    instance.ctx = ctx;
    instance.disposers = disposers;
    instance.running = true;

    try {
        instance.api = (await instance.def.setup(ctx)) ?? undefined;
    } catch (error) {
        // 실패한 모듈은 반쪽 상태로 두지 않는다
        stop(instance);
        throw error;
    }
};

const stop = (instance: ModuleInstance): void => {
    if (!instance.running) return;
    instance.running = false;
    instance.api = undefined;

    if (instance.def.revoke && instance.ctx) instance.def.revoke(instance.ctx);

    for (const disposer of instance.disposers) disposer();
    instance.disposers = [];
    instance.ctx = undefined;
};

const register = async (def: ModuleDefinition, enable: boolean): Promise<void> => {
    if (instances.has(def.id)) throw new Error(`${def.id} is already registered.`);

    const settings: Record<string, SettingValue> = {};

    if (def.settings) {
        const settingsItem = moduleSettingsStorage(def.id);
        const stored = (await settingsItem.getValue()) ?? {};

        for (const [key, schema] of Object.entries(def.settings)) {
            settings[key] = normalizeSetting(schema, (stored as Record<string, unknown>)[key]);
        }

        settingsItem.watch((next: Record<string, SettingValue> | null) => {
            if (!next) return;
            applySettings(def, next);
        });
    }

    const dataItem = moduleDataStorage(def.id);
    const storedData = (await dataItem.getValue()) ?? {};

    const data = new Proxy(storedData as Record<string, JsonValue>, {
        set(target, property, newValue, receiver) {
            const result = Reflect.set(target, property, newValue, receiver);
            void dataItem.setValue(target);
            return result;
        },
        deleteProperty(target, property) {
            const result = Reflect.deleteProperty(target, property);
            void dataItem.setValue(target);
            return result;
        }
    });

    const instance: ModuleInstance = {
        def,
        enable,
        running: false,
        settings,
        data,
        disposers: []
    };

    instances.set(def.id, instance);

    if (enable) await start(instance);
};

const applySettings = (def: ModuleDefinition, stored: Record<string, unknown>): void => {
    const instance = instances.get(def.id);
    if (!instance || !def.settings) return;

    for (const [key, schema] of Object.entries(def.settings)) {
        const nextValue = normalizeSetting(schema, stored[key]);
        if (areEqual(instance.settings[key], nextValue)) continue;

        instance.settings[key] = nextValue;
        if (instance.running) def.onChanged?.(key, nextValue);
    }
};

export const modules = {
    /** popup 렌더링용 스키마 목록 (JSON-serializable) */
    getSchema: (): ModuleSchema[] =>
        Array.from(instances.values()).map((instance) => ({
            id: instance.def.id,
            name: instance.def.name,
            description: instance.def.description,
            enable: instance.enable,
            running: instance.running,
            defaultEnable: instance.def.defaultEnable ?? true,
            settings: instance.def.settings,
            values: instance.def.settings ? {...instance.settings} : undefined
        })),

    /** 모듈 토글. 저장소와 인스턴스를 함께 갱신 */
    toggle: async (id: string, value: boolean): Promise<void> => {
        const instance = instances.get(id);
        if (!instance || instance.enable === value) return;

        instance.enable = value;

        const enables = (await modulesStorage.getValue()) ?? {};
        enables[id] = value;
        await modulesStorage.setValue(enables);

        if (value) await start(instance);
        else stop(instance);
    },

    /** 설정값 변경 (popup→messaging 경로). 저장 + 즉시 적용. 정규화된 값 반환 */
    setSetting: async (id: string, key: string, value: SettingValue): Promise<SettingValue> => {
        const instance = instances.get(id);
        if (!instance || !instance.def.settings || !(key in instance.def.settings)) return value;

        const schema = instance.def.settings[key];
        if (!schema) return value;

        const nextValue = normalizeSetting(schema, value);

        const settingsItem = moduleSettingsStorage(id);
        const stored = ((await settingsItem.getValue()) ?? {}) as Record<string, SettingValue>;
        stored[key] = nextValue;
        await settingsItem.setValue(stored);

        // watch가 같은 컨텍스트에도 발화하지 않는 경우를 대비해 직접 적용 (동일값은 watch에서 skip됨)
        if (!areEqual(instance.settings[key], nextValue)) {
            instance.settings[key] = nextValue;
            if (instance.running) instance.def.onChanged?.(key, nextValue);
        }

        return nextValue;
    },

    /** 단축키 실행 (commands→broadcast). 활성 모듈의 shortcuts만 */
    runShortcut: (command: string): void => {
        for (const instance of instances.values()) {
            if (!instance.running || !instance.enable) continue;

            const shortcut = instance.def.shortcuts?.[command];
            if (shortcut && instance.ctx) void shortcut(instance.ctx, instance.api);
        }
    }
};

/**
 * 모듈 정의를 일괄 등록하고 활성 상태를 감시한다.
 * 비활성 모듈도 스키마 제공을 위해 인스턴스는 만들어지며, setup은 실행되지 않는다.
 */
export const loadAll = async (defs: ModuleDefinition[]): Promise<void> => {
    const enables = (await modulesStorage.getValue()) ?? {};

    const results = await Promise.allSettled(
        defs.map((def) => register(def, enables[def.id] ?? def.defaultEnable ?? true))
    );

    results.forEach((result, index) => {
        const def = defs[index];
        if (result.status === "rejected" && def) {
            console.error(`Failed to load module: ${def.id}`, result.reason);
        }
    });

    // 모듈 활성/비활성 감시 (popup에서 토글)
    modulesStorage.watch((next: Record<string, boolean> | null) => {
        if (!next) return;

        for (const [id, instance] of instances) {
            const stored = next[id] ?? instance.def.defaultEnable ?? true;
            if (instance.enable === stored) continue;
            instance.enable = stored;
            if (stored) void start(instance);
            else stop(instance);
        }
    });
};
