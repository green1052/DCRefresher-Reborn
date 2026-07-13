import {BLOCK_TYPES, MEMO_TYPES} from "./wxtStorage";

type StorageRecord = Record<string, unknown>;

const BLOCK_MODES = ["SAME", "CONTAIN", "NOT_SAME", "NOT_CONTAIN"] as const;

const parseLegacyString = (value: unknown): unknown => {
    if (typeof value !== "string") return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const isBlockMode = (value: unknown): value is RefresherBlockDetectMode => {
    return typeof value === "string" && (BLOCK_MODES as readonly string[]).includes(value);
};

const isBlockValue = (value: unknown): value is RefresherBlockValue => {
    if (!value || typeof value !== "object") return false;

    const blockValue = value as Partial<RefresherBlockValue>;
    return (
        typeof blockValue.content === "string" &&
        typeof blockValue.isRegex === "boolean" &&
        typeof blockValue.isAdvanced === "boolean" &&
        (blockValue.gallery === undefined || typeof blockValue.gallery === "string") &&
        (blockValue.extra === undefined || typeof blockValue.extra === "string") &&
        (blockValue.mode === undefined || isBlockMode(blockValue.mode))
    );
};

const normalizeBlockList = (value: unknown): RefresherBlockValue[] => {
    const parsed = parseLegacyString(value);
    return Array.isArray(parsed) ? parsed.filter(isBlockValue) : [];
};

const isMemoValue = (value: unknown): value is RefresherMemoValue => {
    if (!value || typeof value !== "object") return false;

    const memoValue = value as Partial<RefresherMemoValue>;
    return typeof memoValue.text === "string" && typeof memoValue.color === "string";
};

const normalizeMemoMap = (value: unknown): Record<string, RefresherMemoValue> => {
    const parsed = parseLegacyString(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(Object.entries(parsed).filter(([, memo]) => isMemoValue(memo)));
};

const normalizeBlockMode = (value: unknown): RefresherBlockDetectMode | undefined => {
    const parsed = parseLegacyString(value);
    return isBlockMode(parsed) ? parsed : undefined;
};

// 구 key → 신 key 매핑 규칙
interface KeyMapping {
    oldKey: string;
    newKey: string;
    transform?: (value: unknown) => unknown;
}

const buildKeyMappings = (): KeyMapping[] => {
    const mappings: KeyMapping[] = [];

    // Block: __REFRESHER_BLOCK:TYPE → refresher:block:TYPE
    for (const type of BLOCK_TYPES) {
        mappings.push({
            oldKey: `__REFRESHER_BLOCK:${type}`,
            newKey: `refresher:block:${type}`,
            transform: normalizeBlockList
        });

        // Block mode: __REFRESHER_BLOCK:TYPE:$MODE 또는 :MODE → refresher:block:TYPE:mode
        const legacyModeKey = `__REFRESHER_BLOCK:${type}:MODE`;
        const legacyModeKey2 = `__REFRESHER_BLOCK:${type}:$MODE`;
        mappings.push({
            oldKey: legacyModeKey2,
            newKey: `refresher:block:${type}:mode`,
            transform: normalizeBlockMode
        });
        mappings.push({
            oldKey: legacyModeKey,
            newKey: `refresher:block:${type}:mode`,
            transform: normalizeBlockMode
        });
    }

    // Memo: __REFRESHER_MEMO:TYPE → refresher:memo:TYPE
    for (const type of MEMO_TYPES) {
        mappings.push({
            oldKey: `__REFRESHER_MEMO:${type}`,
            newKey: `refresher:memo:${type}`,
            transform: normalizeMemoMap
        });
    }

    // Modules/Settings: __REFRESHER_MODULES → refresher:modules, __REFRESHER_SETTINGS → refresher:settings
    mappings.push({oldKey: "__REFRESHER_MODULES", newKey: "refresher:modules"});
    mappings.push({oldKey: "__REFRESHER_SETTINGS", newKey: "refresher:settings"});

    // Database: refresher.database.* → refresher:database:*
    mappings.push({oldKey: "refresher.database.ip", newKey: "refresher:database:ip"});
    mappings.push({oldKey: "refresher.database.ban", newKey: "refresher:database:ban"});
    mappings.push({oldKey: "refresher.database.version", newKey: "refresher:database:version"});
    mappings.push({oldKey: "refresher.database.lastUpdate", newKey: "refresher:database:lastUpdate"});

    return mappings;
};

// 모듈 enable 키 마이그레이션: "NAME.enable" → "refresher:module:NAME:enable"
const migrateModuleEnableKeys = (data: StorageRecord): { migrated: StorageRecord; removedKeys: string[] } => {
    const result = {...data};
    const removedKeys: string[] = [];

    for (const key of Object.keys(data)) {
        if (key.endsWith(".enable")) {
            const moduleName = key.slice(0, -".enable".length);
            if (moduleName && !key.includes(":")) {
                const newKey = `refresher:module:${moduleName}:enable`;
                if (!(newKey in result)) {
                    result[newKey] = data[key];
                }
                removedKeys.push(key);
                delete result[key];
            }
        }
    }

    return {migrated: result, removedKeys};
};

// 모듈 data 키 마이그레이션: "refresher.module:NAME" → "refresher:module:NAME:data"
const migrateModuleDataKeys = (data: StorageRecord): { migrated: StorageRecord; removedKeys: string[] } => {
    const result = {...data};
    const removedKeys: string[] = [];

    for (const key of Object.keys(data)) {
        if (key.startsWith("refresher.module:")) {
            const suffix = key.slice("refresher.module:".length);
            if (suffix && !suffix.includes("-")) {
                const newKey = `refresher:module:${suffix}:data`;
                if (!(newKey in result)) {
                    result[newKey] = data[key];
                }
                removedKeys.push(key);
                delete result[key];
            } else if (suffix.includes("-")) {
                const dashIdx = suffix.indexOf("-");
                const moduleName = suffix.slice(0, dashIdx);
                const settingKey = suffix.slice(dashIdx + 1);
                const newKey = `refresher:module:${moduleName}:setting:${settingKey}`;
                if (!(newKey in result)) {
                    result[newKey] = data[key];
                }
                removedKeys.push(key);
                delete result[key];
            }
        }
    }

    return {migrated: result, removedKeys};
};

export const normalizeStorageData = (data: StorageRecord): StorageRecord => {
    const mappings = buildKeyMappings();
    const normalized: StorageRecord = {};
    const processedOldKeys = new Set<string>();

    // 매핑 규칙 적용
    for (const mapping of mappings) {
        if (mapping.oldKey in data) {
            const value = mapping.transform ? mapping.transform(data[mapping.oldKey]) : data[mapping.oldKey];
            if (value !== undefined) {
                normalized[mapping.newKey] = value;
            }
            processedOldKeys.add(mapping.oldKey);
        }
    }

    // 처리되지 않은 키는 그대로 유지
    for (const [key, value] of Object.entries(data)) {
        if (!processedOldKeys.has(key)) {
            normalized[key] = value;
        }
    }

    // 모듈 enable/data 키 마이그레이션
    const {migrated: withEnable, removedKeys: enableRemoved} = migrateModuleEnableKeys(normalized);
    const {migrated: withData, removedKeys: dataRemoved} = migrateModuleDataKeys(withEnable);

    // 처리된 구 키 제거
    for (const key of [...enableRemoved, ...dataRemoved]) {
        delete withData[key];
    }

    return withData;
};

export const migrateLocalStorageData = async (): Promise<void> => {
    const data = await browser.storage.local.get(null);
    const normalized = normalizeStorageData(data);

    if (JSON.stringify(data) === JSON.stringify(normalized)) return;

    const removedKeys = Object.keys(data).filter((key) => !(key in normalized));
    if (removedKeys.length > 0) {
        await browser.storage.local.remove(removedKeys);
    }

    await browser.storage.local.set(normalized);
};