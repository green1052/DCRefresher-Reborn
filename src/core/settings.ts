import browser from "webextension-polyfill";
import * as store from "./store";
import {eventBus} from "./eventbus";

const settings_store: {
    [index: string]: { [index: string]: RefresherSettings }
} = {};

const REFRESHER_NAMESPACE = "DCRefresher Reborn";

export const set = async (
    module: string,
    key: string,
    value: unknown
): Promise<void> => {
    eventBus.emit("refresherUpdateSetting", module, key, value);

    settings_store[module][key].value = value;
    await store.set(`${module}.${key}`, value);

    eventBus.emit("refresherSettingsSync", settings_store);
};

export const setGlobal = async (key: string, value: unknown): Promise<void> => {
    return set(REFRESHER_NAMESPACE, key, value);
};

export const setStore = (module: string, key: string, value: unknown): void => {
    eventBus.emit("refresherUpdateSetting", module, key, value);
    settings_store[module][key].value = value;
};

export const get = (module: string, key: string): Promise<unknown> => {
    return store.get(`${module}.${key}`);
};

export const dump = (): { [index: string]: unknown } => {
    return settings_store;
};

export const load = async (
    module: string,
    key: string,
    settings: RefresherSettings
): Promise<unknown> => {
    if (!settings_store[module]) {
        settings_store[module] = {};
    }

    let got = await get(module, key);

    if (typeof got === "undefined" || typeof got === null) {
        settings.value = settings.default;
        got = settings.default;
    } else {
        settings.value = got;
    }

    settings_store[module][key] = settings;

    return got;
};

eventBus.on("refresherSettingsSync", store => {
    browser.runtime.sendMessage(
        JSON.stringify({
            store
        })
    );
});