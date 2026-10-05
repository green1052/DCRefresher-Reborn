import {useEffect} from "react";
import {storage} from "wxt/utils/storage";
import {create} from "zustand";

import {enablesOf, isModuleEnabled, normalizeSetting, readModuleStorage, settingsOf} from "@/core/module/settings";
import type {AnyModuleMeta} from "@/core/module/types";
import {MODULES_KEY, moduleDataKey, moduleKeyModule, moduleSettingsKey, moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import {storageSync} from "@/core/storage/sync";
import type {SettingValue} from "@/core/storage/types";
import features from "@/features/meta";
import {saveOrReload} from "@/utils/error";
import {once} from "@/utils/once";
import {isRecord} from "@/utils/record";

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
 * 옵션·팝업용 모듈 상태. 저장소에 직접 읽고 쓰며, 열린 디시 탭의 레지스트리가 저장소를 감시해 반영한다.
 * 그래서 디시 탭이 없어도 설정할 수 있다.
 */
export const useModulesStore = create<ModulesState>((set) => ({
    enables: resolveEnables({}),
    values: Object.fromEntries(features.map((feature) => [feature.id, settingsOf(feature, null)])),

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
 * 없어진 모듈·설정의 값과 없어진 모듈의 캐시를 저장소에서 지운다. 남겨 두면 설정은 백업·내보내기에 계속 실려 다니고, 캐시는 공간만 차지한다.
 * 지울 게 있을 때만 쓰고, 설정 쓰기와 같은 enqueue 줄에 세워 옵션에서 바꾼 값을 덮지 않는다.
 */
const pruneStaleSettings = async (): Promise<void> => {
    const ids = new Set(features.map((feature) => feature.id));

    await enqueue(async () => {
        const withSchema = features.filter((feature) => feature.settings);
        // on/off와 설정을 한 번에 읽는다. get(null)은 수백 KB짜리 IP DB까지 읽으니 나머지는 키 이름만 읽는다.
        const [{enables, settings}, keys] = await Promise.all([readModuleStorage(withSchema.map((feature) => feature.id)), browser.storage.local.getKeys()]);
        const staleIds = new Set(Object.keys(enables).filter((id) => !ids.has(id)));
        for (const key of keys) {
            const id = moduleKeyModule(key);
            if (id !== undefined && !ids.has(id)) staleIds.add(id);
        }

        if (staleIds.size > 0) {
            await storage.setItem(MODULES_KEY, Object.fromEntries(Object.entries(enables).filter(([id]) => !staleIds.has(id))));
            await storage.removeItems([...staleIds].flatMap((id) => [moduleSettingsKey(id), moduleDataKey(id)]));
        }

        for (const feature of withSchema) {
            const stored = settings.get(feature.id);
            if (!isRecord(stored)) continue;
            const kept = Object.entries(stored).filter(([key]) => Object.hasOwn(feature.settings!, key));
            // 저장소 값 그대로(검사 전)라 항목(moduleSettingsStorage) 대신 키로 쓴다. 남은 키는 손대지 않는다.
            if (kept.length !== Object.keys(stored).length) await storage.setItem(moduleSettingsKey(feature.id), Object.fromEntries(kept));
        }
    });
};

// 저장한 값은 감시로 되돌아온다. 이미 반영한 값이면 상태를 바꾸지 않는다 (바꾸면 구독하는 화면이 같은 값으로 한 번 더 그린다).
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const setEnables = (stored: unknown): void => {
    const enables = resolveEnables(enablesOf(stored));
    if (!same(enables, useModulesStore.getState().enables)) useModulesStore.setState({enables});
};
const setValues = (feature: AnyModuleMeta, stored: unknown): void => {
    const values = settingsOf(feature, stored);
    if (!same(values, useModulesStore.getState().values[feature.id])) useModulesStore.setState((state) => ({values: {...state.values, [feature.id]: values}}));
};

/** 설정이 있는 모듈. 설정 키로 찾는다. */
const withSettings = new Map<string, AnyModuleMeta>(features.filter((feature) => feature.settings).map((feature) => [moduleSettingsKey(feature.id), feature]));

// on/off와 모든 모듈 설정. 없으면 null → 기본값.
const sync = storageSync([MODULES_KEY, ...[...withSettings.values()].map((feature) => moduleSettingsKey(feature.id))], (key, value) => {
    const feature = withSettings.get(key);
    if (feature) setValues(feature, value);
    else setEnables(value);
});
const persist = (write: () => Promise<void>): Promise<void> => saveOrReload(enqueue(write), sync.load, "모듈 설정을 저장하지 못했습니다.");

/** 옵션·팝업에서 저장소 값을 읽고 변경을 감시한다. 여러 번 불러도 한 번만 한다. */
export const initModulesStore = once(async () => {
    await sync.start();

    // 화면을 그리는 데는 필요 없으니 기다리지 않는다.
    pruneStaleSettings().catch(console.error);
});
