import {moduleEnableStorage, moduleSettingStorage} from "@/storage/wxtStorage";
import {normalizeSettingValue} from "@/core/settings";
import {sendMessage} from "@/http/messaging";
import {useEffect, useState} from "react";

// 타이핑/슬라이더 드래그마다 스토리지 쓰기가 발생하지 않도록 쓰기를 지연 병합한다.
const SETTING_WRITE_DELAY = 300;

const pendingSettingWrites = new Map<
    string,
    {
        timer: ReturnType<typeof setTimeout>;
        module: string;
        key: string;
        value: string | number | boolean;
        previousValue: unknown;
    }
>();

export function useSettings() {
    const [modules, setModules] = useState<ModuleSchemaMap>({});
    const [settings, setSettings] = useState<Record<string, Record<string, RefresherSettings>>>({});

    useEffect(() => {
        void (async () => {
            try {
                const tabs = await browser.tabs.query({url: ["https://*.dcinside.com/*"]});
                const dcTab = tabs.find((tab) => tab.id);
                if (!dcTab?.id) {
                    return;
                }

                const schema = await sendMessage("getSchema", undefined, {tabId: dcTab.id});
                if (!schema) return;

                // 스토리지 IPC를 한 번으로 줄인다.
                const snapshot = await browser.storage.local.get(null);

                const enableMap: ModuleSchemaMap = {};
                const settingsMap: Record<string, Record<string, RefresherSettings>> = {};

                for (const [moduleName, moduleSchema] of Object.entries(schema)) {
                    settingsMap[moduleName] = moduleSchema.settings ?? {};

                    for (const [key, setting] of Object.entries(settingsMap[moduleName])) {
                        // 저장값은 무조건 정규화. 코어와 같은 규칙(range 클램프, option items 검증)을 쓴다.
                        const stored = snapshot[`refresher:module:${moduleName}:setting:${key}`];
                        settingsMap[moduleName][key] = {
                            ...setting,
                            value: normalizeSettingValue(setting, stored ?? setting.value)
                        } as RefresherSettings;
                    }

                    enableMap[moduleName] = {
                        ...moduleSchema,
                        enable: (snapshot[`refresher:module:${moduleName}:enable`] as boolean | null | undefined) ??
                            moduleSchema.default_enable
                    };
                }

                setSettings(settingsMap);
                setModules(enableMap);
            } catch (e) {
                console.error("Failed to load module schema:", e);
            }
        })();
    }, []);

    const settingsCount = (obj: Record<string, RefresherSettings>) => {
        if (!obj) return 0;
        return Object.values(obj).length;
    };

    const updateUserSetting = (
        module: string | undefined,
        key: string | undefined,
        value: unknown
    ) => {
        if (!module || !key) return;

        const setting = settings[module]?.[key];
        if (!setting) return;

        // 저장 전에 코어와 같은 규칙으로 정규화. 코어(applySettingValue)는 같은 값이면 조용히 통과하므로
        // 스토리지에 쓰여진 값이 곧 최종값이 된다.
        const normalizedValue = normalizeSettingValue(setting, value);

        setSettings((prev) => ({
            ...prev,
            [module]: {...prev[module], [key]: {...setting, value: normalizedValue} as RefresherSettings}
        }));

        const id = `${module}:${key}`;
        const previousValue = pendingSettingWrites.get(id)?.previousValue ?? setting.value;

        const existing = pendingSettingWrites.get(id);
        if (existing) clearTimeout(existing.timer);

        const pending = {
            timer: setTimeout(() => {
                void (async () => {
                    pendingSettingWrites.delete(id);
                    try {
                        await moduleSettingStorage(pending.module, pending.key).setValue(pending.value);
                    } catch (e) {
                        console.error("Failed to update user setting:", e);

                        setSettings((prev) => ({
                            ...prev,
                            [module]: {
                                ...prev[module],
                                [key]: {...setting, value: previousValue} as RefresherSettings
                            }
                        }));
                        moduleSettingStorage(pending.module, pending.key)
                            .setValue(previousValue as string | number | boolean)
                            .catch(() => {});
                    }
                })();
            }, SETTING_WRITE_DELAY),
            module,
            key,
            value: normalizedValue,
            previousValue
        };

        pendingSettingWrites.set(id, pending);
    };

    const typeWrap = (value: unknown) => {
        if (typeof value === "boolean") {
            return value ? "On" : "Off";
        }

        if (typeof value === "string" && value === "") {
            return "없음";
        }

        return value;
    };

    const updateModuleStatus = async (name: string, value: boolean) => {
        setModules((prev) =>
            prev[name] ? {...prev, [name]: {...prev[name], enable: value}} : prev
        );
        await moduleEnableStorage(name).setValue(value);
    };

    return {
        modules,
        settings,
        hasSettings: Object.keys(settings).length > 0,
        hasModules: Object.keys(modules).length > 0,
        modulesWithBasicSettings: Object.keys(settings).filter(
            (module) => settings[module] && settingsCount(settings[module]) > 0
        ),
        updateUserSetting,
        updateModuleStatus,
        typeWrap
    };
}
