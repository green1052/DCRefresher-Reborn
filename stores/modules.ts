import {create} from "zustand";

import {normalizeSetting} from "@/core/module/settings";
import type {ModuleDefinition} from "@/core/module/types";
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

const normalizeAll = (feature: ModuleDefinition, stored: Record<string, unknown> | null): Values =>
    Object.fromEntries(Object.entries(feature.settings ?? {}).map(([key, schema]) => [key, normalizeSetting(schema, stored?.[key])]));

const resolveEnables = (stored: Record<string, boolean> | null): Record<string, boolean> =>
    Object.fromEntries(features.map((feature) => [feature.id, stored?.[feature.id] ?? feature.defaultEnable ?? true]));

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
    enables: resolveEnables(null),
    values: Object.fromEntries(features.map((feature) => [feature.id, normalizeAll(feature, null)])),

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

/** 저장소 값 로드 + 변경 감시. 여러 번 불러도 1회 */
export const initModulesStore = once(async () => {
    const setEnables = (stored: Record<string, boolean>): void => useModulesStore.setState({enables: resolveEnables(stored)});
    const setValues = (feature: ModuleDefinition, stored: Record<string, unknown> | undefined): void =>
        useModulesStore.setState((state) => ({values: {...state.values, [feature.id]: normalizeAll(feature, stored ?? null)}}));

    const settings = features.filter((feature) => feature.settings).map((feature) => ({feature, item: moduleSettingsStorage(feature.id)}));
    const [enables, values] = await Promise.all([modulesStorage.getValue(), Promise.all(settings.map(({item}) => item.getValue()))]);

    // 다 읽은 뒤에 감시를 건다 — 읽기가 실패하면 아무것도 걸리지 않아, 다시 시도해도 두 번 걸리지 않는다
    setEnables(enables);
    modulesStorage.watch(setEnables);
    for (const [index, {feature, item}] of settings.entries()) {
        setValues(feature, values[index]);
        item.watch((next) => setValues(feature, next));
    }
});
