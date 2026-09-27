import {storage} from "wxt/utils/storage";
import {create} from "zustand";

import {isModuleEnabled, normalizeSetting, normalizeSettings} from "@/core/module/settings";
import type {AnyModule} from "@/core/module/types";
import {moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import type {SettingValue} from "@/core/storage/types";
import features from "@/features";
import {once} from "@/utils/once";

type Values = Record<string, SettingValue>;

interface ModulesState {
    /** 모듈 on/off (저장값 없으면 defaultEnable) */
    enables: Record<string, boolean>;
    /** 모듈별 설정값 (스키마로 정규화됨) */
    values: Record<string, Values>;
    toggle: (id: string, value: boolean) => Promise<void>;
    changeSetting: (id: string, key: string, value: SettingValue) => Promise<void>;
}

const featureById = new Map(features.map((feature) => [feature.id, feature]));

const resolveEnables = (stored: Record<string, boolean>): Record<string, boolean> =>
    Object.fromEntries(features.map((feature) => [feature.id, isModuleEnabled(feature, stored)]));

// 쓰기는 읽고-고쳐-쓰기라 연달아 바꾸면 둘 다 옛 값을 읽어 앞의 쓰기를 덮는다 — 한 줄로 세운다
let writes: Promise<void> = Promise.resolve();
const enqueue = (write: () => Promise<void>): Promise<void> => {
    const next = writes.then(write);
    writes = next.catch(() => {});
    return next;
};

/**
 * 옵션 페이지용 모듈 상태. 저장소에 직접 읽고 쓰며, 열린 디시 탭의 레지스트리가 저장소를 감시해 반영한다.
 * 그래서 디시 탭이 없어도 설정할 수 있다.
 */
export const useModulesStore = create<ModulesState>((set) => ({
    enables: resolveEnables({}),
    values: Object.fromEntries(features.map((feature) => [feature.id, normalizeSettings(feature, null)])),

    toggle: async (id, value) => {
        set((state) => ({enables: {...state.enables, [id]: value}}));
        await enqueue(async () => modulesStorage.setValue({...(await modulesStorage.getValue()), [id]: value}));
    },

    changeSetting: async (id, key, value) => {
        const schema = featureById.get(id)?.settings?.[key];
        if (!schema) return;

        const next = normalizeSetting(schema, value);
        set((state) => ({values: {...state.values, [id]: {...state.values[id], [key]: next}}}));

        const item = moduleSettingsStorage(id);
        await enqueue(async () => item.setValue({...(await item.getValue()), [key]: next}));
    }
}));

const SETTINGS_KEY = /^refresher:module:(.+):settings$/;

/**
 * 없어진 모듈·설정을 저장소에서 지운다 — 모듈을 없애거나 설정을 빼도 옛 값이 백업·내보내기에 계속 실려 다닌다.
 * 지울 게 있을 때만 쓰고, 설정 쓰기와 같은 줄에 세워 옵션에서 바꾼 값을 덮지 않는다
 */
const pruneStaleSettings = async (): Promise<void> => {
    const ids = new Set(features.map((feature) => feature.id));

    await enqueue(async () => {
        const enables = await modulesStorage.getValue();
        const staleIds = new Set(Object.keys(enables).filter((id) => !ids.has(id)));
        // 키 이름만 읽는다 — get(null)은 수백 KB짜리 IP DB까지 읽는다 (getKeys가 없는 브라우저는 켜짐 목록에 남은 모듈만)
        const keys = typeof browser.storage.local.getKeys === "function" ? await browser.storage.local.getKeys() : [];
        for (const key of keys) {
            const id = SETTINGS_KEY.exec(key)?.[1];
            if (id !== undefined && !ids.has(id)) staleIds.add(id);
        }

        if (staleIds.size > 0) {
            await modulesStorage.setValue(Object.fromEntries(Object.entries(enables).filter(([id]) => !staleIds.has(id))));
            await storage.removeItems([...staleIds].map((id) => `local:refresher:module:${id}:settings` as const));
        }

        for (const feature of features) {
            if (!feature.settings) continue;
            const item = moduleSettingsStorage(feature.id);
            const stored = await item.getValue();
            const kept = Object.entries(stored).filter(([key]) => Object.hasOwn(feature.settings!, key));
            if (kept.length !== Object.keys(stored).length) await item.setValue(Object.fromEntries(kept));
        }
    });
};

/** 저장소 값 로드 + 변경 감시 (옵션·팝업). 여러 번 불러도 1회 */
export const initModulesStore = once(async () => {
    const setEnables = (stored: Record<string, boolean>): void => useModulesStore.setState({enables: resolveEnables(stored)});
    const setValues = (feature: AnyModule, stored: Record<string, unknown> | undefined): void =>
        useModulesStore.setState((state) => ({values: {...state.values, [feature.id]: normalizeSettings(feature, stored)}}));

    const settings = features.filter((feature) => feature.settings).map((feature) => ({feature, item: moduleSettingsStorage(feature.id)}));
    const [enables, values] = await Promise.all([modulesStorage.getValue(), Promise.all(settings.map(({item}) => item.getValue()))]);

    // 다 읽은 뒤에 감시를 건다 — 읽기가 실패하면 아무것도 걸리지 않아, 다시 시도해도 두 번 걸리지 않는다
    setEnables(enables);
    modulesStorage.watch(setEnables);
    for (const [index, {feature, item}] of settings.entries()) {
        setValues(feature, values[index]);
        item.watch((next) => setValues(feature, next));
    }

    // 화면을 그리는 데는 필요 없다 — 기다리지 않는다
    pruneStaleSettings().catch(console.error);
});
