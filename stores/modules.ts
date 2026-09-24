import {create} from "zustand";

import {sendMessage} from "@/core/messaging/protocol";
import type {ModuleSchema} from "@/core/module/types";
import type {SettingValue} from "@/core/storage/types";

interface ModulesState {
    schemas: ModuleSchema[];
    /** 콘텐츠 스크립트가 없는 탭(스키마 로드 실패) 여부 */
    unavailable: boolean;
    /** 현재 활성 디시인사이드 탭 (messaging 대상) */
    tabId?: number;
    setSchemas: (schemas: ModuleSchema[]) => void;
    setUnavailable: (unavailable: boolean) => void;
    toggle: (id: string, value: boolean, tabId?: number) => Promise<void>;
    changeSetting: (id: string, key: string, value: SettingValue, tabId?: number) => Promise<void>;
}

export const useModulesStore = create<ModulesState>((set, get) => ({
    schemas: [],
    unavailable: false,

    setSchemas: (schemas) => set({schemas}),
    setUnavailable: (unavailable) => set({unavailable}),

    toggle: async (id, value, tabId) => {
        set({schemas: get().schemas.map((schema) => (schema.id === id ? {...schema, enable: value} : schema))});
        if (tabId) await sendMessage("dcr:toggleModule", {id, value}, {tabId}).catch(() => {});
    },

    changeSetting: async (id, key, value, tabId) => {
        // 낙관적 갱신 후, 콘텐츠가 정규화(range clamp 등)한 값으로 확정
        set({
            schemas: get().schemas.map((schema) =>
                schema.id === id && schema.settings
                    ? {...schema, values: {...schema.values, [key]: value}}
                    : schema
            )
        });

        if (!tabId) return;

        try {
            const applied = await sendMessage("dcr:setSetting", {id, key, value}, {tabId});
            set({
                schemas: get().schemas.map((schema) =>
                    schema.id === id && schema.settings
                        ? {...schema, values: {...schema.values, [key]: applied}}
                        : schema
                )
            });
        } catch {
            // 콘텐츠 없음 — 낙관적 값 유지
        }
    }
}));
