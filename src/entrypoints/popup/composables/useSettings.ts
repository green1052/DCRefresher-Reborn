import {moduleEnableStorage, moduleSettingStorage} from "@/storage/wxtStorage";
import {sendMessage} from "@/http/messaging";
import {computed, nextTick, onMounted, ref} from "vue";

// 백그라운드가 디시 탭 전체로 뿌려준다.
const sendToAllDcTabs = async (type: string, data: Record<string, unknown>): Promise<void> => {
    try {
        await sendMessage("broadcast", {type, data});
    } catch (e) {
        console.error(`Failed to broadcast ${type}:`, e);
    }
};

export function useSettings() {
    const modules = ref<ModuleSchemaMap>({});
    const settings = ref<Record<string, Record<string, RefresherSettings>>>({});

    onMounted(async () => {
        try {
            const tabs = await browser.tabs.query({url: ["https://*.dcinside.com/*"]});
            const dcTab = tabs.find((tab) => tab.id);
            if (!dcTab?.id) {
                return;
            }

            const schema = await sendMessage("getSchema", undefined, {tabId: dcTab.id});
            if (!schema) return;

            const enableMap: ModuleSchemaMap = {};
            const settingsMap: Record<string, Record<string, RefresherSettings>> = {};

            for (const [moduleName, moduleSchema] of Object.entries(schema)) {
                settingsMap[moduleName] = moduleSchema.settings ?? {};

                for (const [key, setting] of Object.entries(settingsMap[moduleName])) {
                    const stored = await moduleSettingStorage(moduleName, key).getValue();
                    if (stored !== null && stored !== undefined) {
                        (setting.value as unknown) = stored;
                    }
                }

                const storedEnable = await moduleEnableStorage(moduleName).getValue();
                enableMap[moduleName] = {
                    ...moduleSchema,
                    enable: storedEnable ?? moduleSchema.default_enable
                };
            }

            settings.value = settingsMap;
            modules.value = enableMap;
        } catch (e) {
            console.error("Failed to load module schema:", e);
        }
    });

    const hasSettings = computed(() => Object.keys(settings.value).length > 0);
    const hasModules = computed(() => Object.keys(modules.value).length > 0);

    const settingsCount = (obj: Record<string, RefresherSettings>) => {
        if (!obj) return 0;
        return Object.values(obj).length;
    };

    const modulesWithBasicSettings = computed(() => {
        return Object.keys(settings.value).filter(
            (module) => settings.value[module] && settingsCount(settings.value[module]) > 0
        );
    });

    const updateUserSetting = async (
        module: string | undefined,
        key: string | undefined,
        value: unknown
    ) => {
        if (!module || !key) return;
        const setting = settings.value[module]?.[key];
        if (!setting) return;

        const previousValue = setting.value;
        (setting.value as unknown) = value;

        try {
            await moduleSettingStorage(module, key).setValue(value as string | number | boolean);
            await sendToAllDcTabs("updateSettingValue", {name: module, key, value: value as string | number | boolean});
        } catch (e) {
            (setting.value as unknown) = previousValue;

            try {
                await moduleSettingStorage(module, key).setValue(previousValue as string | number | boolean);
            } catch (rollbackError) {
                console.error("Failed to rollback user setting:", rollbackError);
            }

            console.error("Failed to update user setting:", e);
        }
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

    const moveToModuleTab = (moduleName: string) => {
        nextTick(() => {
            const app = document.querySelector<HTMLElement>("#refresher-app");
            if (!app) return;

            for (const element of app.querySelectorAll<HTMLElement>(".refresher-module.highlight")) {
                element.classList.remove("highlight");
            }

            for (const element of app.querySelectorAll<HTMLElement>(".tab .refresher-module .title")) {
                if (element.textContent !== moduleName) continue;

                element.parentElement?.parentElement?.classList.add("highlight");

                element.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

                setTimeout(() => {
                    for (const el of app.querySelectorAll<HTMLElement>(".refresher-module.highlight")) {
                        el.classList.remove("highlight");
                    }
                }, 1000);
            }
        });
    };

    const updateModuleStatus = async (name: string, value: boolean) => {
        if (modules.value[name]) {
            modules.value[name].enable = value;
        }
        await moduleEnableStorage(name).setValue(value);
        await sendToAllDcTabs("updateModuleStatus", {name, value});
    };

    return {
        modules,
        settings,
        hasSettings,
        hasModules,
        modulesWithBasicSettings,
        updateUserSetting,
        updateModuleStatus,
        typeWrap,
        moveToModuleTab
    };
}