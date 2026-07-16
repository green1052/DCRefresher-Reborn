import {moduleDataStorage, moduleEnableStorage} from "@/storage/wxtStorage";
import {onMessage} from "@/http/messaging";
import eventBus from "./eventbus";
import filter from "./filtering";
import settings from "./settings";

export type ModuleStore = Record<string, RefresherModule>;

const moduleStore: ModuleStore = {};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

const runModule = async (module: RefresherModule): Promise<void> => {
    if (typeof module.func === "function") {
        await module.func();
    }
};

const revokeModule = async (module: RefresherModule): Promise<void> => {
    if (typeof module.revoke === "function") {
        await module.revoke();
    }
};

type ModuleStatusPayload = {
    name: string;
    value: boolean;
};

type SettingUpdatePayload = {
    name: string;
    key: string;
    value: string | number | boolean;
};

const isModuleStatusPayload = (value: unknown): value is ModuleStatusPayload => {
    return (
        typeof value === "object" &&
        value !== null &&
        "name" in value &&
        "value" in value &&
        typeof value.name === "string" &&
        typeof value.value === "boolean"
    );
};

const isSettingUpdatePayload = (value: unknown): value is SettingUpdatePayload => {
    return (
        typeof value === "object" &&
        value !== null &&
        "name" in value &&
        "key" in value &&
        "value" in value &&
        typeof value.name === "string" &&
        typeof value.key === "string"
    );
};

export const modules = {
    lists: (): ModuleStore => moduleStore,
    load: (module: unknown): Promise<void> =>
        modules.register(module as RefresherModule),
    register: async (module: unknown): Promise<void> => {
        const mod = module as RefresherModule;
        if (!mod) throw new Error("Module is not defined.");
        if (moduleStore[mod.name]) throw new Error(`${mod.name} is already registered.`);

        const promises: Promise<void>[] = [];

        promises.push(
            moduleEnableStorage(mod.name).getValue().then((enable) => {
                if (enable === null || enable === undefined) {
                    moduleEnableStorage(mod.name).setValue(mod.default_enable);
                    mod.enable = mod.default_enable;
                    return;
                }

                mod.enable = enable;
            })
        );

        if (typeof mod.settings === "object") {
            (mod as { status?: Record<string, unknown> }).status ??= {};

            promises.push(
                ...Object.entries(mod.settings).map(async ([key, value]) => {
                    const loaded = await settings.load(mod.name, key, value);
                    (mod.status as Record<string, unknown>)[key] = loaded;
                })
            );
        }

        if (typeof mod.data === "object") {
            promises.push(
                moduleDataStorage(mod.name).getValue().then((data) => {
                    const currentData = isRecord(data)
                        ? data
                        : isRecord(mod.data)
                            ? {...mod.data}
                            : {};

                    mod.data = new Proxy(currentData, {
                        set(target, p, newValue, receiver) {
                            const result = Reflect.set(target, p, newValue, receiver);
                            moduleDataStorage(mod.name).setValue(target);
                            return result;
                        },

                        deleteProperty(target, p) {
                            const result = Reflect.deleteProperty(target, p);
                            moduleDataStorage(mod.name).setValue(target);
                            return result;
                        }
                    });
                })
            );
        }

        moduleStore[mod.name] = mod;

        await Promise.all(promises);

        // 모든 설정 로드 완료 후 다른 모듈이 사용할 수 있도록 게시
        const moduleConfig: Record<string, unknown> = {...(mod.status as Record<string, unknown> ?? {})};
        if (isRecord(mod.data)) {
            Object.assign(moduleConfig, mod.data);
        }
        eventBus.emit("refresherModuleConfig", mod.name, moduleConfig);

        if (!mod.enable || mod.url?.test(location.href) === false) return;

        await runModule(mod);
    }
};

export default modules;

onMessage("getSchema", () => {
    const schema: ModuleSchemaMap = {};
    for (const mod of Object.values(moduleStore)) {
        schema[mod.name] = {
            name: mod.name,
            description: mod.description,
            default_enable: mod.default_enable,
            enable: mod.enable,
            settings: mod.settings
        };
    }
    return schema;
});

onMessage("updateModuleStatus", async ({data}) => {
    if (!isModuleStatusPayload(data) || !moduleStore[data.name]) return;

    if (moduleStore[data.name].enable === data.value) return;

    moduleStore[data.name].enable = data.value;
    moduleEnableStorage(data.name).setValue(data.value);

    if (data.value) {
        const existingFilterIds = new Set(filter.ids());
        await runModule(moduleStore[data.name]);

        for (const filterId of filter.ids()) {
            if (!existingFilterIds.has(filterId)) {
                void filter.runSpecific(filterId);
            }
        }

        return;
    }

    await revokeModule(moduleStore[data.name]);
});

onMessage("updateSettingValue", ({data}) => {
    if (!isSettingUpdatePayload(data)) return;
    settings.setStore(data.name, data.key, data.value);
});

onMessage("executeShortcut", ({data}) => {
    if (typeof data !== "string") return;

    for (const key of Object.keys(moduleStore)) {
        const module = moduleStore[key] as RefresherModule;
        if (
            module &&
            typeof module.shortcuts === "object" &&
            typeof (module.shortcuts as Record<string, () => void>)[data] === "function"
        ) {
            (module.shortcuts as Record<string, () => void>)[data].bind(module)();
        }
    }
});

eventBus.on("refresherUpdateSetting", (mod, key, value) => {
    const module = moduleStore[mod] as RefresherModule;

    if (module !== undefined) {
        (module as { status?: Record<string, unknown> }).status ??= {};
        (module.status as Record<string, unknown>)[key] = value;
    } else {
        return;
    }

    // 설정 변경 시 다른 모듈에 재게시
    const moduleConfig: Record<string, unknown> = {...(module.status as Record<string, unknown> ?? {})};
    if (isRecord(module.data)) {
        Object.assign(moduleConfig, module.data);
    }
    eventBus.emit("refresherModuleConfig", mod, moduleConfig);

    if (!module.enable || !module.update || typeof (module.update as Record<string, (value: unknown) => void>)[key] !== "function") return;

    return (module.update as Record<string, (value: unknown) => void>)[key].bind(module)(value);
});