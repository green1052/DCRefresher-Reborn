import * as block from "./block";
import * as communicate from "./communicate";
import {eventBus} from "./eventbus";
import {filter} from "./filtering";
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

const revokeModule = (mod: RefresherModule) => {
    if (typeof mod.revoke === "function") {
        const plugins: ModuleItem[] = [];

        if (Array.isArray(module.require)) {
            for (const require of module.require as (keyof ItemToRefresherMap)[]) {
                plugins.push(UTILS[require]);
            }
        }

        mod.revoke.bind(mod)(...plugins);
    }

    if (typeof mod.memory === "object") {
        for (const key in mod.memory) {
            mod.memory[key] = undefined;
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

        const start = performance.now();

        if (module_store[module.name]) throw `${module.name} is already registered.`;

        const promises: Promise<void>[] = [];

        promises.push(
            storage
                .get<boolean | undefined>(`${module.name}.enable`)
                .then((enable) => {
                    module.enable = typeof enable === "boolean" ? enable : module.default_enable;

                    if (enable === undefined)
                        storage.set(`${module.name}.enable`, module.default_enable);
                })
        );

        if (typeof module.settings === "object") {
            module.status ??= {};

            promises.push(
                ...Object
                    .entries(module.settings)
                    .map(async ([key, value]) => {
                        module.status[key] = await settings.load(module.name, key, value);
                    })
            );
        }

        if (typeof module.data === "object") {
            promises.push(
                storage.module.get(module.name)
                    .then((data) => {
                        module.data = data ?? {};
                        module.data = new Proxy(module.data, {
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

        const stringify = JSON.stringify({
            module_store,
            settings_store: settings.dump()
        });

        browser.runtime.sendMessage(stringify);

        if (!module.enable) {
            console.log(`📁 ignoring ${module.name}. The module is disabled.`);
            return;
        }

        if (module.url && !module.url.test(location.href)) {
            console.log(`📁 ignoring ${module.name}. current URL is not matching with the module's URL value.`);
            return;
        }

        runModule(module);

        console.log(`📁 ${module.name} module loaded. took ${(performance.now() - start).toFixed(2)}ms.`);
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
    console.log(`Received shortcut execute: ${data}.`);

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

// 설정 창에서 설정을 변경할 경우 실행되는 함수를 정의합니다.
eventBus.on(
    "refresherUpdateSetting",
    (module: string, key: string, value: unknown) => {
        const mod = module_store[module];

        if (mod !== undefined) {
            mod.status ??= {};
            mod.status[key] = value;
        }

        // 모듈이 활성화되지 않은 상태일 경우 모듈 설정 업데이트 함수 호출을 건너뜁니다.
        if (!mod.enable || !mod.update || typeof mod.update[key] !== "function")
            return;

        const plugins: ModuleItem[] = [];

        if (Array.isArray(mod.require)) {
            for (const require of mod.require) {
                plugins.push(UTILS[require]);
            }
        }

        mod.update[key].bind(mod)(value, ...plugins);
    }
);
