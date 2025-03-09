import * as block from "./block";
import * as communicate from "./communicate";
import { eventBus } from "./eventbus";
import { filter } from "./filtering";
import Frame from "./frame";
import * as memo from "./memo";
import * as settings from "./settings";
import * as dom from "../utils/dom";
import * as http from "../utils/http";
import * as ip from "../utils/ip";
import storage from "../utils/storage";
import browser from "webextension-polyfill";

type ModuleItem = ValueOf<ItemToRefresherMap>;

export type ModuleStore = Record<string, RefresherModule>;

const UTILS: ItemToRefresherMap = {
    filter,
    Frame,
    eventBus,
    http,
    ip,
    block,
    dom,
    memo
};

const module_store: ModuleStore = {};

const runModule = (module: RefresherModule) => {
    const plugins: ModuleItem[] = [];

    if (Array.isArray(module.require)) {
        for (const require of module.require as (keyof ItemToRefresherMap)[]) {
            plugins.push(UTILS[require]);
        }
    }

    if (typeof module.func === "function") module.func.bind(module)(...plugins);
};

const revokeModule = (module: RefresherModule) => {
    if (typeof module.revoke === "function") {
        const plugins: ModuleItem[] = [];

        if (Array.isArray(module.require)) {
            for (const require of module.require as (keyof ItemToRefresherMap)[]) {
                plugins.push(UTILS[require]);
            }
        }

        module.revoke.bind(module)(...plugins);
    }

    if (typeof module.memory === "object") {
        for (const key in module.memory) {
            module.memory[key] = undefined;
        }
    }
};

export const modules = {
    lists: (): ModuleStore => module_store,

    load: (module: RefresherModule): Promise<void> => {
        return new Promise((resolve) => modules.register(module).then(resolve));
    },

    register: async (module: RefresherModule): Promise<void> => {
        if (!module) throw "Module is not defined.";
        if (module_store[module.name]) throw `${module.name} is already registered.`;

        const promises: Promise<void>[] = [];

        promises.push(
            storage.get<boolean | undefined>(`${module.name}.enable`).then((enable) => {
                if (enable === undefined)
                    storage.set(`${module.name}.enable`, module.default_enable);

                module.enable = typeof enable === "boolean" ? enable : module.default_enable;
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
                    module.data = new Proxy(data ?? {}, {
                        set(target, p, newValue, receiver) {
                            storage.module.setGlobal(module.name, JSON.stringify(module.data));
                            return Reflect.set(target, p, newValue, receiver);
                        },

                        deleteProperty(target, p) {
                            storage.module.setGlobal(module.name, JSON.stringify(module.data));
                            return Reflect.deleteProperty(target, p);
                        }
                    });
                })
            );
        }

        module_store[module.name] = module;

        await Promise.all(promises);

        browser.runtime.sendMessage(
            JSON.stringify({
                module_store,
                settings_store: settings.dump()
            })
        );

        if (!module.enable || !module.url?.test(location.href)) return;

        runModule(module);
    }
};

communicate.addHook("updateModuleStatus", (data) => {
    module_store[data.name].enable = data.value as boolean;
    storage.set(`${data.name}.enable`, data.value);

    browser.runtime.sendMessage(
        JSON.stringify({
            module_store
        })
    );

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
