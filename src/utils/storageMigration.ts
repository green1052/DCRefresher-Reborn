import {BLOCK_TYPES, MEMO_TYPES} from "./storage";

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

export const normalizeStorageData = (data: StorageRecord): StorageRecord => {
    const normalized = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, parseLegacyString(value)])
    );

    for (const type of BLOCK_TYPES) {
        const blockKey = `__REFRESHER_BLOCK:${type}`;
        normalized[blockKey] = normalizeBlockList(normalized[blockKey]);

        const modeKey = `__REFRESHER_BLOCK:${type}:$MODE`;
        const legacyModeKey = `__REFRESHER_BLOCK:${type}:MODE`;
        const mode = normalizeBlockMode(normalized[modeKey]) ?? normalizeBlockMode(normalized[legacyModeKey]);

        if (mode) normalized[modeKey] = mode;
        delete normalized[legacyModeKey];
    }

    for (const type of MEMO_TYPES) {
        const memoKey = `__REFRESHER_MEMO:${type}`;
        normalized[memoKey] = normalizeMemoMap(normalized[memoKey]);
    }

    return normalized;
};

export const migrateLocalStorageData = async (): Promise<void> => {
    const data = await browser.storage.local.get(null);
    const normalized = normalizeStorageData(data);

    if (JSON.stringify(data) === JSON.stringify(normalized)) return;

    await browser.storage.local.set(normalized);
};
