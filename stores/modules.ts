import {create} from "zustand";

import {normalizeSetting} from "@/core/module/settings";
import type {ModuleDefinition} from "@/core/module/types";
import {moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import type {SettingValue} from "@/core/storage/types";
import features from "@/features";

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

/**
 * 옵션 페이지용 모듈 상태. 저장소에 직접 읽고 쓰며, 열린 디시 탭의 레지스트리가 저장소를 감시해 반영한다.
 * 그래서 디시 탭이 없어도 설정할 수 있다.
 */
export const useModulesStore = create<ModulesState>((set) => ({
    enables: resolveEnables(null),
    values: Object.fromEntries(features.map((feature) => [feature.id, normalizeAll(feature, null)])),

    toggle: async (id, value) => {
        set((state) => ({enables: {...state.enables, [id]: value}}));
        await modulesStorage.setValue({...(await modulesStorage.getValue()), [id]: value});
    },

    changeSetting: async (id, key, value) => {
        const schema = featureById.get(id)?.settings?.[key];
        if (!schema) return;

        const next = normalizeSetting(schema, value);
        set((state) => ({values: {...state.values, [id]: {...state.values[id], [key]: next}}}));

        const item = moduleSettingsStorage(id);
        await item.setValue({...(await item.getValue()), [key]: next});
    }
}));

let initialized: Promise<void> | null = null;

/** 저장소 값 로드 + 변경 감시. 여러 번 불러도 1회 */
export const initModulesStore = (): Promise<void> =>
    (initialized ??= (async () => {
        const setEnables = (stored: Record<string, boolean> | null): void => useModulesStore.setState({enables: resolveEnables(stored)});
        setEnables(await modulesStorage.getValue());
        modulesStorage.watch(setEnables);

        await Promise.all(
            features
                .filter((feature) => feature.settings)
                .map(async (feature) => {
                    const item = moduleSettingsStorage(feature.id);
                    const setValues = (stored: Record<string, unknown> | null): void =>
                        useModulesStore.setState((state) => ({values: {...state.values, [feature.id]: normalizeAll(feature, stored)}}));

                    setValues(await item.getValue());
                    item.watch(setValues);
                })
        );
    })());
