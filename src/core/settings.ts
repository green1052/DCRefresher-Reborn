import { eventBus } from "./eventbus";
import storage from "../utils/storage";
import browser from "webextension-polyfill";

export type SettingsStore = Record<string, Record<string, RefresherSettings>>;

const settings_store: SettingsStore = {};

export const set = async (
    module: string,
    key: string,
    value: string | number | boolean
): Promise<void> => {
    eventBus.emit("refresherUpdateSetting", module, key, value);

    settings_store[module][key].value = value;
    await storage.set(`${module}.${key}`, value);

    eventBus.emit("refresherSettingsSync", settings_store);
};

export const setStore = (module: string, key: string, value: string | number | boolean): void => {
    eventBus.emit("refresherUpdateSetting", module, key, value);
    settings_store[module][key].value = value;
};

export const dump = (): Record<string, unknown> => settings_store;

export const load = async (
    module: string,
    key: string,
    settings: RefresherSettings
): Promise<unknown> => {
    settings_store[module] ??= {};

    const got =
        (await storage.get<string | number | boolean>(`${module}.${key}`)) ?? settings.default;
    settings.value = got;

    settings_store[module][key] = settings;

    return got;
};

eventBus.on("refresherSettingsSync", (store) => {
    browser.runtime.sendMessage(
        JSON.stringify({
            store
        })
    );
});
