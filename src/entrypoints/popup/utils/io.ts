import {isBlockValue, normalizeBlockList, normalizeBlockMode} from "@/core/block";
import {isMemoValue, normalizeMemoMap} from "@/core/memo";

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

export const normalizeBlockImportList = normalizeBlockList;
export const normalizeBlockModeValue = (value: unknown) => normalizeBlockMode(value, "SAME");
export const normalizeMemoImportMap = normalizeMemoMap;
