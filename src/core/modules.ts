import log from "../utils/logger";
import storage from "../utils/storage";
import {eventBus} from "./eventbus";
import {filter} from "./filtering";
import Frame from "./frame";
import * as ip from "../utils/ip";
import * as http from "../utils/http";
import * as dom from "../utils/dom";
import * as memo from "./memo";
import browser from "webextension-polyfill";

import * as settings from "./settings";
import * as block from "./block";
import DeepProxy from "../utils/deepProxy";

import * as communicate from "./communicate";

const UTILS: { [index: string]: Record<string, unknown> } = {
    filter,
    Frame,
    eventBus,
    http,
    ip,
    block,
    dom,
    memo
};

export interface ModuleStore {
    [index: string]: RefresherModule
}

const module_store: ModuleStore = {};

const runtime = browser && browser.runtime;

const runModule = (mod: RefresherModule) => {
    const plugins = [];

    if (mod.require && mod.require.length) {
        const len = mod.require.length;
        for (let mi = 0; mi < len; mi++) {
            plugins.push(UTILS[mod.require[mi]]);
        }
    }

    if (mod.func) {
        mod.func.bind(mod)(...plugins);
    }
};

const revokeModule = (mod: RefresherModule) => {
    if (mod.revoke) {
        const plugins = [];

        if (mod.require && mod.require.length) {
            const len = mod.require.length;
            for (let mi = 0; mi < len; mi++) {
                plugins.push(UTILS[mod.require[mi]]);
            }
        }

        mod.revoke.bind(mod)(...plugins);
    }

    if (mod.memory) {
        for (const key in mod.memory) {
            mod.memory[key] = undefined;
        }
    }
};

export const modules = {
    lists: (): { [index: string]: RefresherModule } => {
        return module_store;
    },
    load: (...mods: RefresherModule[]): Promise<void> =>
        new Promise<void>((resolve) => {
            return Promise.all(
                mods.map((v) => {
                    return modules.register(v);
                })
            ).then(() => {
                resolve();
            });
        }),

    register: async (mod: RefresherModule): Promise<void> => {
        const start = performance.now();

        if (typeof module_store[mod.name] !== "undefined") {
            throw `${mod.name} is already registered.`;
        }

        const enable = await storage.get<boolean>(`${mod.name}.enable`);
        mod.enable = enable;

        if (typeof enable === "undefined" || enable === null) {
            storage.set(`${mod.name}.enable`, mod.default_enable);
            mod.enable = mod.default_enable;
        }

        if (mod.settings) {
            for (const key in mod.settings) {
                if (!mod.status) {
                    mod.status = {};
                }

                mod.status[key] = await settings.load(mod.name, key, mod.settings[key]);
            }
        }

        if (mod.data) {
            for (const key in mod.data) {
                const originValue = mod.data[key];
                mod.data[key] = (await storage.module.get(mod.name)) || originValue;
            }

            mod.data = (await storage.module.get(mod.name)) || {};

            mod.data = new DeepProxy(mod.data, {
                set(): boolean {
                    storage.module.setGlobal(mod.name, JSON.stringify(mod.data));

                    return true;
                },

                deleteProperty(): boolean {
                    storage.module.setGlobal(mod.name, JSON.stringify(mod.data));

                    return true;
                }
            });
        }

        module_store[mod.name] = mod;

        const stringify = JSON.stringify({
            module_store,
            settings_store: settings.dump()
        });

        runtime.sendMessage(stringify);

        if (!mod.enable) {
            log(`???? ignoring ${mod.name}. The module is disabled.`);
            return;
        }

        if (mod.url && !mod.url.test(location.href)) {
            log(
                `???? ignoring ${mod.name}. current URL is not matching with the module's URL value.`
            );
            return;
        }

        runModule(mod);

        log(
            `???? ${mod.name} module loaded. took ${(performance.now() - start).toFixed(
                2
            )}ms.`
        );
    },

    getData(name: string, key?: string): unknown {
        if (!module_store[name]) {
            throw "Given module is not exists.";
        }

        if (key) {
            return module_store[name].data[key];
        }

        return module_store[name].data;
    }
};

communicate.addHook("updateModuleStatus", (data) => {
    module_store[data.name].enable = data.value as boolean;
    storage.set(`${data.name}.enable`, data.value);

    runtime.sendMessage(
        JSON.stringify({
            module_store
        })
    );

    if (!data.value) {
        revokeModule(module_store[data.name]);
        return;
    }

    runModule(module_store[data.name]);
});

communicate.addHook("updateSettingValue", (data) => {
    settings.setStore(data.name, data.key, data.value);
});

communicate.addHook("executeShortcut", (data) => {
    const keys = Object.keys(module_store);

    log(`Received shortcut execute: ${data}.`);

    keys.forEach((key) => {
        if (module_store[key] && typeof module_store[key].shortcuts === "object") {
            if (module_store[key].shortcuts[data]) {
                module_store[key].shortcuts[data].bind(module_store[key])();
            }
        }
    });
});

// ?????? ????????? ????????? ????????? ?????? ???????????? ????????? ???????????????.
eventBus.on(
    "refresherUpdateSetting",
    (module: string, key: string, value: unknown) => {
        const mod = module_store[module];

        if (mod) {
            if (!mod.status) {
                mod.status = {};
            }

            mod.status[key] = value;
        }

        // ????????? ??????????????? ?????? ????????? ?????? ?????? ?????? ???????????? ?????? ????????? ???????????????.
        if (!mod.enable) {
            return;
        }

        if (mod.update && typeof mod.update[key] === "function") {
            const utils: unknown[] = [];

            const requires = mod.require as string[] | undefined;

            if (requires) {
                for (let i = 0; i < requires.length; i++) {
                    const name = requires[i];

                    if (UTILS[name]) {
                        utils.push(UTILS[name]);
                    }
                }
            }

            mod.update[key].bind(mod)(value, ...utils);
        }
    }
);