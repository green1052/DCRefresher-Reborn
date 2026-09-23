import {moduleSettingStorage} from "@/storage/wxtStorage";

import eventBus from "./eventbus";

export type SettingsStore = Record<string, Record<string, RefresherSettings>>;

const settingsStore: SettingsStore = {};

export const normalizeSettingValue = (
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
            // items에 없는 값이면 셀렉트가 빈 채로 표시되므로 기본값으로.
            return typeof value === "string" && value in settings.items ? value : settings.default;
    }
};

export const setStore = (module: string, key: string, value: string | number | boolean): void => {
    const setting = settingsStore[module]?.[key];
    if (!setting) return;

    const normalizedValue = normalizeSettingValue(setting, value);
    if (setting.value === normalizedValue) return;

    // 리스너가 emit 도중 값을 읽어도 항상 최신 값이도록 갱신이 먼저.
    setting.value = normalizedValue;
    eventBus.emit("refresherUpdateSetting", module, key, normalizedValue);
};

export const load = async (
    module: string,
    key: string,
    settings: RefresherSettings,
    storedValue?: unknown
): Promise<unknown> => {
    settingsStore[module] ??= {};

    // storedValue는 modules.register가 storage 스냅샷에서 넘겨준다. 없으면 저장된 적 없는 것.
    const value = normalizeSettingValue(settings, storedValue ?? settings.default);
    settings.value = value;

    settingsStore[module][key] = settings;

    if (storedValue !== undefined && storedValue !== null && storedValue !== value) {
        void moduleSettingStorage(module, key).setValue(value);
    }

    return value;
};

export default {
    setStore,
    load
};
