import {MEMO_TYPE_NAMES, MEMO_TYPES, memoStorage} from "@/core/storage/items";
import type {MemoEntry, MemoType} from "@/core/storage/types";

const caches: Record<MemoType, Record<string, MemoEntry>> = {
    UID: {},
    NICK: {},
    IP: {}
};

export const isMemoEntry = (value: unknown): value is MemoEntry => {
    if (!value || typeof value !== "object") return false;

    const memo = value as Partial<MemoEntry>;
    return (
        typeof memo.text === "string" &&
        typeof memo.color === "string" &&
        (memo.gallery === undefined || typeof memo.gallery === "string")
    );
};

export const normalizeMemoMap = (value: unknown): Record<string, MemoEntry> => {
    if (typeof value === "string") {
        try {
            return normalizeMemoMap(JSON.parse(value));
        } catch {
            return {};
        }
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(Object.entries(value).filter(([, memo]) => isMemoEntry(memo)));
};

const checkValidType = (type: string): type is MemoType => (MEMO_TYPES as string[]).includes(type);

/** 메모를 추가/수정합니다. */
export const set = async (type: MemoType, user: string, text: string, color: string, gallery?: string): Promise<void> => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${MEMO_TYPES.join(", ")}]`);

    caches[type][user] = {text, color, ...(gallery ? {gallery} : {})};
    await memoStorage[type].setValue({...caches[type]});
};

/** 메모 내용을 구합니다. */
export const get = (type: MemoType, user: string): MemoEntry | undefined => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${MEMO_TYPES.join(", ")}]`);

    return caches[type][user];
};

/** 메모를 삭제합니다. */
export const remove = async (type: MemoType, user: string): Promise<void> => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${MEMO_TYPES.join(", ")}]`);

    delete caches[type][user];
    await memoStorage[type].setValue({...caches[type]});
};

export const clear = async (type: MemoType): Promise<void> => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${MEMO_TYPES.join(", ")}]`);

    caches[type] = {};
    await memoStorage[type].setValue({});
};

export {MEMO_TYPE_NAMES};

let initialized = false;

/** 캐시 초기화 + 변경 감시. 콘텐츠/팝업 각 1회 */
export const init = (): Promise<void> => {
    if (initialized) return Promise.resolve();
    initialized = true;

    return (async () => {
        await Promise.all(
            MEMO_TYPES.map(async (type) => {
                caches[type] = normalizeMemoMap(await memoStorage[type].getValue());

                memoStorage[type].watch((next) => {
                    if (next) caches[type] = normalizeMemoMap(next);
                });
            })
        );
    })();
};
