import type {SettingValue} from "@/core/storage/types";

import type {ModuleDefinition, SettingSchema} from "./types";

/** 모듈 on/off — 저장값이 boolean이 아니면(가져온 "false" 문자열 등) defaultEnable. 콘텐츠·배경·옵션이 같은 기준을 쓴다 */
export const isModuleEnabled = (def: Pick<ModuleDefinition, "id" | "defaultEnable">, enables: Record<string, unknown>): boolean => {
    const value = enables[def.id];
    return typeof value === "boolean" ? value : def.defaultEnable ?? true;
};

/** 저장값을 스키마에 맞춘다 — 타입이 틀리면 기본값, range는 범위로 자르고, order는 스키마에 없는·겹친 항목 제거/새 항목 추가 */
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
                ? Math.min(schema.max, Math.max(schema.min, value))
                : schema.default;
        case "order": {
            const itemKeys = new Set(Object.keys(schema.items));
            // 가져온 값에 같은 항목이 두 번 있으면 배지가 두 번 그려진다 — Set으로 첫 자리만 남긴다
            const stored = [...new Set((Array.isArray(value) ? value : schema.default).filter(
                (key): key is string => typeof key === "string" && itemKeys.has(key)
            ))];
            // 스키마에 새로 추가된 항목은 맨 뒤에 넣는다.
            for (const key of schema.default) {
                if (itemKeys.has(key) && !stored.includes(key)) stored.push(key);
            }
            return stored;
        }
    }
};

/** 모듈의 저장값 전체를 스키마대로 — 옵션 스토어와 콘텐츠 레지스트리가 같은 값을 보게 둘 다 이것을 쓴다 */
export const normalizeSettings = (def: ModuleDefinition, stored: Record<string, unknown> | null | undefined): Record<string, SettingValue> =>
    Object.fromEntries(Object.entries(def.settings ?? {}).map(([key, schema]) => [key, normalizeSetting(schema, stored?.[key])]));

export const areEqual = (a: SettingValue | undefined, b: SettingValue): boolean => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
    return false;
};

