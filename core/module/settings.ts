import {storage} from "wxt/utils/storage";

import {MODULES_KEY, moduleSettingsKey} from "@/core/storage/items";
import type {SettingValue} from "@/core/storage/types";
import {isRecord} from "@/utils/record";

import type {ModuleDefinition, SettingSchema} from "./types";

/** 모듈 on/off. 저장값이 boolean이 아니면(가져온 설정의 "false" 문자열 등) defaultEnable을 따른다. 콘텐츠·배경·옵션이 모두 이 함수로 판단한다. */
export const isModuleEnabled = (def: Pick<ModuleDefinition, "id" | "defaultEnable">, enables: Record<string, unknown>): boolean => {
    const value = enables[def.id];
    return typeof value === "boolean" ? value : def.defaultEnable ?? true;
};

/** 스키마의 기본값. order는 복사해 돌려주므로 받은 쪽이 고쳐도 스키마는 그대로다. */
export const defaultValue = (schema: SettingSchema): SettingValue => (schema.type === "order" ? [...schema.default] : schema.default);

/**
 * 저장값을 스키마에 맞춘다. 타입이 틀리면 기본값을 쓰고, range는 슬라이더처럼 step 단위로 맞춰 min~max로 자른다
 * (가져온 설정의 소수 등. 동시 요청 수는 정수가 아니면 utils/limit이 던진다).
 * order는 스키마에 없거나 겹친 항목을 빼고, 새로 생긴 항목을 덧붙인다.
 */
export const normalizeSetting = (schema: SettingSchema, value: unknown): SettingValue => {
    switch (schema.type) {
        case "check":
            return typeof value === "boolean" ? value : schema.default;
        case "text":
            return typeof value === "string" ? value : schema.default;
        case "option":
            return typeof value === "string" && Object.hasOwn(schema.items, value) ? value : schema.default;
        case "key":
            return typeof value === "string" && /^[a-z0-9]$/.test(value) ? value : schema.default;
        case "color":
            return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : schema.default;
        case "range":
            return typeof value === "number" && Number.isFinite(value)
                ? Math.min(schema.max, Math.max(schema.min, schema.min + Math.round((value - schema.min) / schema.step) * schema.step))
                : schema.default;
        case "order": {
            const itemKeys = new Set(Object.keys(schema.items));
            // 가져온 값에 같은 항목이 두 번 있으면 배지가 두 번 그려지므로 첫 자리만 남긴다.
            const stored = [...new Set((Array.isArray(value) ? value : schema.default).filter(
                (key): key is string => typeof key === "string" && itemKeys.has(key)
            ))];
            for (const key of schema.default) {
                if (itemKeys.has(key) && !stored.includes(key)) stored.push(key);
            }
            return stored;
        }
    }
};

export const areEqual = (a: SettingValue | undefined, b: SettingValue): boolean => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
    return false;
};


/** 저장소의 모듈 on/off 값. 없거나 모양이 다르면 빈 객체(모두 defaultEnable). */
export const enablesOf = (stored: unknown): Record<string, unknown> => (isRecord(stored) ? stored : {});

/**
 * 저장소의 모듈 설정을 스키마에 맞춘다. 없거나 모양이 다르면 기본값.
 * 옵션 스토어·콘텐츠 레지스트리·배경이 같은 값을 보도록 모두 이 함수를 쓴다.
 */
export const settingsOf = (def: Pick<ModuleDefinition, "settings">, stored: unknown): Record<string, SettingValue> => {
    const values = isRecord(stored) ? stored : {};
    return Object.fromEntries(Object.entries(def.settings ?? {}).map(([key, schema]) => [key, normalizeSetting(schema, values[key])]));
};

/**
 * 모듈 on/off와 주어진 모듈들의 설정을 한 번의 storage.local.get으로 읽는다. 모듈마다 따로 읽으면 왕복이 모듈 수만큼 쌓인다.
 * 항목(defineItem)은 만드는 순간 키마다 한 번 더 읽으므로 키로 읽는다 (core/storage/items.ts). 설정은 저장소 값 그대로다 (settingsOf로 맞춘다).
 * 콘텐츠 레지스트리·배경 모듈이 같이 쓴다.
 */
export const readModuleStorage = async (ids: readonly string[]): Promise<{ enables: Record<string, unknown>; settings: Map<string, unknown> }> => {
    // getItems는 받은 키로 값을 돌려주지만 순서는 약속이 아니므로 키로 짝짓는다 (core/storage/sync.ts와 같다).
    const items = new Map((await storage.getItems([MODULES_KEY, ...ids.map(moduleSettingsKey)])).map(({key, value}) => [key, value]));
    return {enables: enablesOf(items.get(MODULES_KEY)), settings: new Map(ids.map((id) => [id, items.get(moduleSettingsKey(id)) ?? null]))};
};
