import {modulesStorage, settingsStorage} from "../utils/storage";

import storage from "../utils/webStorage";
import communicate from "./communicate";
import eventBus from "./eventbus";
import settings from "./settings";

export type ModuleStore = Record<string, RefresherModule>;

const module_store: ModuleStore = {};

const runModule = (module: RefresherModule) => {
    // @ts-ignore
    if (typeof module.func === "function") module.func();
};

const revokeModule = (module: RefresherModule) => {
    if (typeof module.revoke === "function") {
        // @ts-ignore
        module.revoke();
    }

    if (typeof module.memory === "object") {
        for (const key in module.memory) {
            module.memory[key] = undefined;
        }
    }
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
            }).catch((error) => {
                console.error(`Failed to load enable state for module ${module.name}:`, error);
                module.enable = module.default_enable;
            })
        );

        if (typeof module.settings === "object") {
            // @ts-ignore
            module.status ??= {};

            promises.push(
                ...Object.entries(module.settings).map(async ([key, value]) => {
                    try {
                        // @ts-ignore
                        module.status[key] = await settings.load(module.name, key, value);
                    } catch (error) {
                        console.error(`Failed to load setting ${key} for module ${module.name}:`, error);
                        // @ts-ignore
                        module.status[key] = value.default;
                    }
                })
            );
        }

        if (typeof module.data === "object") {
            promises.push(
                storage.module.get(module.name).then((data) => {
                    // @ts-ignore
                    module.data = new Proxy(data ?? module.data ?? {}, {
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
                }).catch((error) => {
                    console.error(`Failed to load data for module ${module.name}:`, error);
                    // @ts-ignore
                    module.data = new Proxy(module.data ?? {}, {
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

        try {
            await Promise.all(promises);

            const modulesSnap = JSON.parse(JSON.stringify(module_store));
            const settingsSnap = JSON.parse(JSON.stringify(settings.dump()));

            await modulesStorage.setValue(modulesSnap);
            await settingsStorage.setValue(settingsSnap);
        } catch (error) {
            console.error(`Failed to persist module state for ${module.name}:`, error);
        }

        if (!module.enable || module.url?.test(location.href) === false) return;

        try {
            runModule(module);
        } catch (error) {
            console.error(`Failed to run module ${module.name}:`, error);
        }
    }
};

export default modules;

communicate.addHook("updateModuleStatus", (data) => {
    if (!module_store[data.name]) return;
    module_store[data.name].enable = data.value as boolean;
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
    settings.setStore(data.name, data.key, data.value);
});

communicate.addHook("executeShortcut", (data) => {
    for (const key of Object.keys(module_store)) {
        if (
            module_store[key] &&
            typeof module_store[key].shortcuts === "object" &&
            typeof module_store[key].shortcuts![data] === "function"
        ) {
            module_store[key].shortcuts![data].bind(module_store[key])();
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