import type {SettingValue} from "@/core/storage/types";

import type {SettingSchema} from "./types";

/** 저장값을 스키마에 맞춘다 — 타입이 틀리면 기본값, range는 범위로 자르고, order는 스키마에 없는 항목 제거/새 항목 추가 */
export const normalizeSetting = (schema: SettingSchema, value: unknown): SettingValue => {
    switch (schema.type) {
        case "check":
            return typeof value === "boolean" ? value : schema.default;
        case "text":
        case "option":
            return typeof value === "string" ? value : schema.default;
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
            const stored = (Array.isArray(value) ? value : schema.default).filter(
                (key): key is string => typeof key === "string" && itemKeys.has(key)
            );
            // 스키마에 새로 추가된 항목은 맨 뒤에 넣는다.
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

