import {useEffect} from "react";
import {storage} from "wxt/utils/storage";
import {create} from "zustand";

import {enablesOf, isModuleEnabled, normalizeSetting, normalizeSettings, settingsOf} from "@/core/module/settings";
import type {AnyModuleMeta} from "@/core/module/types";
import {migrateModuleSettings} from "@/core/migrate-settings";
import {MODULES_KEY, moduleSettingsKey, moduleSettingsStorage, modulesStorage, settingsKeyModule} from "@/core/storage/items";
import {storageSync} from "@/core/storage/sync";
import type {SettingValue} from "@/core/storage/types";
import features from "@/features/meta";
import {saveOrReload} from "@/utils/error";
import {once} from "@/utils/once";

type Values = Record<string, SettingValue>;

interface ModulesState {
    /** 모듈 on/off (저장값 없으면 defaultEnable). */
    enables: Record<string, boolean>;
    /** 모듈별 설정값 (스키마로 정규화됨). */
    values: Record<string, Values>;
    toggle: (id: string, value: boolean) => Promise<void>;
    changeSetting: (id: string, key: string, value: SettingValue) => Promise<void>;
}

const featureById = new Map(features.map((feature) => [feature.id, feature]));

const resolveEnables = (stored: Record<string, unknown>): Record<string, boolean> =>
    Object.fromEntries(features.map((feature) => [feature.id, isModuleEnabled(feature, stored)]));

// 쓰기가 읽고-고쳐-쓰기라 동시에 바꾸면 둘 다 옛 값을 읽어 앞의 쓰기를 덮는다. 한 줄로 세운다.
// 옵션·팝업 창은 확장 출처를 같이 쓰므로 Web Locks로 창 여러 개에 걸쳐 세운다 (설정 정리가 다른 창의 변경을 덮지 않게).
const enqueue = (write: () => Promise<void>): Promise<void> => navigator.locks.request("refresher:module-settings", write);

/**
 * 옵션 페이지용 모듈 상태. 저장소에 직접 읽고 쓰며, 열린 디시 탭의 레지스트리가 저장소를 감시해 반영한다.
 * 그래서 디시 탭이 없어도 설정할 수 있다.
 */
export const useModulesStore = create<ModulesState>((set) => ({
    enables: resolveEnables({}),
    values: Object.fromEntries(features.map((feature) => [feature.id, normalizeSettings(feature, null)])),

    toggle: async (id, value) => {
        set((state) => ({enables: {...state.enables, [id]: value}}));
        await persist(async () => modulesStorage().setValue({...(await modulesStorage().getValue()), [id]: value}));
    },

    changeSetting: async (id, key, value) => {
        const schema = featureById.get(id)?.settings?.[key];
        if (!schema) return;

        const next = normalizeSetting(schema, value);
        set((state) => ({values: {...state.values, [id]: {...state.values[id], [key]: next}}}));

        const item = moduleSettingsStorage(id);
        await persist(async () => item.setValue({...(await item.getValue()), [key]: next}));
    }
}));

/** 켜진 모듈의 extensionPageVars를 이 페이지(옵션·팝업)의 <html>에 넣는다. 모듈을 끄거나 설정을 바꾸면 따라간다. */
export const useExtensionPageVars = (): void => {
    const enables = useModulesStore((state) => state.enables);
    const values = useModulesStore((state) => state.values);

    useEffect(() => {
        const root = document.documentElement.style;
        const vars = features.flatMap((feature) =>
            enables[feature.id] && feature.extensionPageVars ? Object.entries(feature.extensionPageVars(values[feature.id] ?? {})) : []);
        for (const [name, value] of vars) root.setProperty(name, value);

        return () => {
            for (const [name] of vars) root.removeProperty(name);
        };
    }, [enables, values]);
};

/**
 * 없어진 모듈·설정의 값을 저장소에서 지운다. 남겨 두면 백업·내보내기에 계속 실려 다닌다.
 * 지울 게 있을 때만 쓰고, 설정 쓰기와 같은 enqueue 줄에 세워 옵션에서 바꾼 값을 덮지 않는다.
 */
const pruneStaleSettings = async (): Promise<void> => {
    const ids = new Set(features.map((feature) => feature.id));

    await enqueue(async () => {
        const enables = await modulesStorage().getValue();
        const staleIds = new Set(Object.keys(enables).filter((id) => !ids.has(id)));
        // get(null)은 수백 KB짜리 IP DB까지 읽으니 키 이름만 읽는다. getKeys가 없는 브라우저는 켜짐 목록에 남은 모듈만 지운다.
        const keys = typeof browser.storage.local.getKeys === "function" ? await browser.storage.local.getKeys() : [];
        for (const key of keys) {
            const id = settingsKeyModule(key);
            if (id !== undefined && !ids.has(id)) staleIds.add(id);
        }

        if (staleIds.size > 0) {
            await modulesStorage().setValue(Object.fromEntries(Object.entries(enables).filter(([id]) => !staleIds.has(id))));
            await storage.removeItems([...staleIds].map(moduleSettingsKey));
        }

        for (const feature of features) {
            if (!feature.settings) continue;
            const item = moduleSettingsStorage(feature.id);
            const original = await item.getValue();
            // 업데이트 직후 배경이 옮기기 전에 여기서 먼저 지우면 옛 설정('IP 정보 끔' 등)이 사라지므로 정리 전에 옮긴다.
            const stored = migrateModuleSettings(feature.id, original);
            const kept = Object.entries(stored).filter(([key]) => Object.hasOwn(feature.settings!, key));
            if (stored !== original || kept.length !== Object.keys(stored).length) await item.setValue(Object.fromEntries(kept));
        }
    });
};

const setEnables = (stored: unknown): void => useModulesStore.setState({enables: resolveEnables(enablesOf(stored))});
const setValues = (feature: AnyModuleMeta, stored: unknown): void =>
    useModulesStore.setState((state) => ({values: {...state.values, [feature.id]: settingsOf(feature, stored)}}));

/** 설정이 있는 모듈. 설정 키로 찾는다. */
const withSettings = new Map<string, AnyModuleMeta>(features.filter((feature) => feature.settings).map((feature) => [moduleSettingsKey(feature.id), feature]));

// on/off와 모든 모듈 설정. 없으면 null → 기본값.
const sync = storageSync([MODULES_KEY, ...[...withSettings.values()].map((feature) => moduleSettingsKey(feature.id))], (key, value) => {
    const feature = withSettings.get(key);
    if (feature) setValues(feature, value);
    else setEnables(value);
});
const load = sync.load;

const persist = (write: () => Promise<void>): Promise<void> => saveOrReload(enqueue(write), load, "모듈 설정을 저장하지 못했습니다.");

/** 옵션·팝업에서 저장소 값을 읽고 변경을 감시한다. 여러 번 불러도 한 번만 한다. */
export const initModulesStore = once(async () => {
    await sync.start();

    // 화면을 그리는 데는 필요 없으니 기다리지 않는다.
    pruneStaleSettings().catch(console.error);
});
