import { sendToBackground } from "@plasmohq/messaging";

import http from "../utils/http";
import ip from "../utils/ip";
import storage from "../utils/storage";
import block from "./block";
import communicate from "./communicate";
import eventBus from "./eventbus";
import filter from "./filtering";
import Frame from "./frame";
import memo from "./memo";
import settings from "./settings";

type ModuleItem = ValueOf<ItemToRefresherMap>;

export type ModuleStore = Record<string, RefresherModule>;

const UTILS: ItemToRefresherMap = {
    filter,
    Frame,
    eventBus,
    http,
    ip,
    block,
    memo
};

const module_store: ModuleStore = {};

const runModule = (module: RefresherModule) => {
    const plugins: ModuleItem[] = Array.isArray(module.require)
        ? (module.require as (keyof ItemToRefresherMap)[]).map((require) => UTILS[require])
        : [];

    // @ts-ignore
    if (typeof module.func === "function") module.func(...plugins);
};

const revokeModule = (module: RefresherModule) => {
    if (typeof module.revoke === "function") {
        const plugins: ModuleItem[] = Array.isArray(module.require)
            ? (module.require as (keyof ItemToRefresherMap)[]).map((require) => UTILS[require])
            : [];

        // @ts-ignore
        module.revoke(...plugins);
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
            })
        );

        if (typeof module.settings === "object") {
            module.status ??= {};

            promises.push(
                ...Object.entries(module.settings).map(async ([key, value]) => {
                    module.status[key] = await settings.load(module.name, key, value);
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
                })
            );
        }

        module_store[module.name] = module;

        await Promise.all(promises);

        sendToBackground({
            name: "store",
            body: {
                action: "update",
                type: "modules",
                data: {
                    module_store: JSON.parse(JSON.stringify(module_store)),
                    settings_store: JSON.parse(JSON.stringify(settings.dump()))
                }
            }
        });

        if (!module.enable || module.url?.test(location.href) === false) return;

        runModule(module);
    }
};

export default modules;

communicate.addHook("updateModuleStatus", (data) => {
    module_store[data.name].enable = data.value as boolean;
    storage.set(`${data.name}.enable`, data.value);

    sendToBackground({
        name: "store",
        body: {
            action: "update",
            type: "modules",
            data: {
                module_store: JSON.parse(JSON.stringify(module_store))
            }
        }
    });

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
    }

    if (!module.enable || !module.update || typeof module.update[key] !== "function") return;

    const plugins: ModuleItem[] = [];

    if (Array.isArray(module.require)) {
        for (const require of module.require as (keyof ItemToRefresherMap)[]) {
            plugins.push(UTILS[require]);
        }
    }

    module.update[key].bind(module)(value, ...plugins);
});
