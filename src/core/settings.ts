import {moduleSettingStorage} from "@/storage/wxtStorage";

import eventBus from "./eventbus";

export type SettingsStore = Record<string, Record<string, RefresherSettings>>;

const settingsStore: SettingsStore = {};

const normalizeSettingValue = (
    settings: RefresherSettings,
    value: unknown
): string | number | boolean => {
    switch (settings.type) {
        case "check":
            return typeof value === "boolean" ? value : settings.default;
        case "text":
            return typeof value === "string" ? value : settings.default;
        case "range":
            return typeof value === "number" && Number.isFinite(value)
                ? Math.min(settings.max, Math.max(settings.min, value))
                : settings.default;
        case "option":
            return typeof value === "string" ? value : settings.default;
    }
};

export const set = async (module: string, key: string, value: string | number | boolean): Promise<void> => {
    const setting = settingsStore[module]?.[key];
    if (!setting) return;

    const normalizedValue = normalizeSettingValue(setting, value);
    eventBus.emit("refresherUpdateSetting", module, key, normalizedValue);

    setting.value = normalizedValue;
    await moduleSettingStorage(module, key).setValue(normalizedValue);
};

export const setStore = (module: string, key: string, value: string | number | boolean): void => {
    const setting = settingsStore[module]?.[key];
    if (!setting) return;

    const normalizedValue = normalizeSettingValue(setting, value);
    eventBus.emit("refresherUpdateSetting", module, key, normalizedValue);
    setting.value = normalizedValue;
};

export const load = async (module: string, key: string, settings: RefresherSettings): Promise<unknown> => {
    settingsStore[module] ??= {};

    const storedValue = await moduleSettingStorage(module, key).getValue();
    const value = normalizeSettingValue(settings, storedValue ?? settings.default);
    settings.value = value;

    settingsStore[module][key] = settings;

    if (storedValue !== undefined && storedValue !== null && storedValue !== value) {
        await moduleSettingStorage(module, key).setValue(value);
    }

    return value;
};

export default {
    set,
    setStore,
    load
};
