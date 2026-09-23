import {moduleSettingStorage} from "@/storage/wxtStorage";

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

// 저장값을 정규화해 settings.value에 채운다. 값 전파(모듈 update 호출)는 modules가 담당한다.
export const load = async (
    module: string,
    key: string,
    settings: RefresherSettings,
    storedValue?: unknown
): Promise<unknown> => {
    const value = normalizeSettingValue(settings, storedValue ?? settings.default);
    settings.value = value;

    if (storedValue !== undefined && storedValue !== null && storedValue !== value) {
        void moduleSettingStorage(module, key).setValue(value);
    }

    return value;
};
