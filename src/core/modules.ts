import {modulesStorage, settingsStorage} from "@/utils/storage";
import storage from "../utils/webStorage";
import communicate from "./communicate";
import eventBus from "./eventbus";
import settings from "./settings";

export type ModuleStore = Record<string, RefresherModule>;

const module_store: ModuleStore = {};

const runModule = (module: RefresherModule) => {
    if (typeof module.func === "function")
        module.func();
};

const revokeModule = (module: RefresherModule) => {
    if (typeof module.revoke === "function") {
        module.revoke();
    }

    if (typeof module.memory === "object") {
        for (const key in module.memory) {
            module.memory[key] = undefined;
        }
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
    lists: (): ModuleStore => module_store,
    load: (module: RefresherModule): Promise<void> => modules.register(module),
    register: async (module: RefresherModule): Promise<void> => {
        if (!module) throw "Module is not defined.";
        if (module_store[module.name]) throw `${module.name} is already registered.`;

        const promises: Promise<void>[] = [];

        promises.push(
            storage.get<boolean | undefined>(`${module.name}.enable`).then((enable) => {
                if (enable === undefined) {
                    storage.set(`${module.name}.enable`, module.default_enable);
                    module.enable = module.default_enable;
                    return;
                }

                module.enable = enable;
            })
        );

        if (typeof module.settings === "object") {
            module.status ??= {};

            promises.push(
                ...Object.entries(module.settings).map(async ([key, value]) => {
                    const loaded = await settings.load(module.name, key, value);
                    module.status[key] = loaded;
                })
            );
        }

        if (typeof module.data === "object") {
            promises.push(
                storage.module.get(module.name).then((data) => {
                    const currentData = (data ?? module.data ?? {}) as Record<string, unknown>;
                    module.data = new Proxy(currentData, {
                        set(target, p, newValue, receiver) {
                            const result = Reflect.set(target, p, newValue, receiver);
                            storage.module.setGlobal(module.name, target);
                            return result;
                        },

                        deleteProperty(target, p) {
                            const result = Reflect.deleteProperty(target, p);
                            storage.module.setGlobal(module.name, target);
                            return result;
                        }
                    });
                })
            );
        }

        module_store[module.name] = module;

        await Promise.all(promises);

        const modulesSnap = JSON.parse(JSON.stringify(module_store));
        const settingsSnap = JSON.parse(JSON.stringify(settings.dump()));

        await modulesStorage.setValue(modulesSnap);
        await settingsStorage.setValue(settingsSnap);

        if (!module.enable || module.url?.test(location.href) === false) return;

        runModule(module);
    }
};

export default modules;

communicate.addHook("updateModuleStatus", (data) => {
    if (!isModuleStatusPayload(data) || !module_store[data.name]) return;
    module_store[data.name].enable = data.value;
    storage.set(`${data.name}.enable`, data.value);

    const modulesSnap = JSON.parse(JSON.stringify(module_store));
    modulesStorage.setValue(modulesSnap);

    if (data.value) {
        runModule(module_store[data.name]);
        return;
    }

    revokeModule(module_store[data.name]);
});

communicate.addHook("updateSettingValue", (data) => {
    if (!isSettingUpdatePayload(data)) return;
    settings.setStore(data.name, data.key, data.value);
});

communicate.addHook("executeShortcut", (data) => {
    if (typeof data !== "string") return;

    for (const key of Object.keys(module_store)) {
        if (
            module_store[key] &&
            typeof module_store[key].shortcuts === "object" &&
            typeof module_store[key].shortcuts?.[data] === "function"
        ) {
            module_store[key].shortcuts?.[data].bind(module_store[key])();
        }
    }
});

eventBus.on("refresherUpdateSetting", (mod: string, key: string, value: unknown) => {
    const module = module_store[mod];

    if (module !== undefined) {
        module.status ??= {};
        module.status[key] = value;
    } else {
        return;
    }

    if (!module.enable || !module.update || typeof module.update[key] !== "function") return;

    module.update[key].bind(module)(value);
});
