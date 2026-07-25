import {BLOCK_DETECT_MODE_TYPE_NAMES as blockDetectModeTypeNames} from "@/core/block";

export const copyToClipboard = async (payload: unknown) => {
    try {
        await navigator.clipboard.writeText(JSON.stringify(payload));
        alert("클립보드에 복사되었습니다.");
    } catch {
        alert("클립보드에 복사하지 못했습니다.");
    }
};

export const parseImportData = (example: string) => {
    const result = prompt("가져올 데이터를 입력하세요.", example);
    if (!result) return null;

    try {
        const parsed = JSON.parse(result) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
        }

        return parsed as Record<string, unknown>;
    } catch {
        alert("데이터가 잘못됐습니다.");
        return null;
    }
};

export const isBlockImportValue = (value: unknown): value is RefresherBlockValue => {
    if (!value || typeof value !== "object") return false;

    const blockValue = value as Partial<RefresherBlockValue>;
    return (
        typeof blockValue.content === "string" &&
        typeof blockValue.isRegex === "boolean" &&
        (blockValue.gallery === undefined || typeof blockValue.gallery === "string") &&
        (blockValue.extra === undefined || typeof blockValue.extra === "string") &&
        (blockValue.mode === undefined || Object.hasOwn(blockDetectModeTypeNames, blockValue.mode))
    );
};

export const normalizeBlockImportList = (value: unknown): RefresherBlockValue[] => {
    if (typeof value === "string") {
        try {
            return normalizeBlockImportList(JSON.parse(value));
        } catch {
            return [];
        }
    }

    return Array.isArray(value) ? value.filter(isBlockImportValue) : [];
};

export const normalizeBlockModeValue = (value: unknown): RefresherBlockDetectMode | undefined => {
    if (typeof value !== "string") return;
    if (Object.hasOwn(blockDetectModeTypeNames, value)) return value as RefresherBlockDetectMode;

    try {
        return normalizeBlockModeValue(JSON.parse(value));
    } catch {
        return;
    }
};

export const isMemoImportValue = (value: unknown): value is RefresherMemoValue => {
    if (!value || typeof value !== "object") return false;

    const memoValue = value as Partial<RefresherMemoValue>;
    return (
        typeof memoValue.text === "string" &&
        typeof memoValue.color === "string" &&
        (memoValue.gallery === undefined || typeof memoValue.gallery === "string")
    );
};

export const normalizeMemoImportMap = (value: unknown): Record<string, RefresherMemoValue> => {
    if (typeof value === "string") {
        try {
            return normalizeMemoImportMap(JSON.parse(value));
        } catch {
            return {};
        }
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(Object.entries(value).filter(([, memo]) => isMemoImportValue(memo)));
};