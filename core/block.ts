import {blockDefaultsStorage, blockStorage, BLOCK_TYPES, DEFAULT_DETECT_MODE, DETECT_MODES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {LRUCache} from "@/core/lru";

const caches: Record<BlockType, BlockEntry[]> = {
    NICK: [],
    ID: [],
    IP: [],
    TITLE: [],
    TEXT: [],
    COMMENT: [],
    DCCON: [],
    TAB: []
};

const defaults: Record<BlockType, DetectMode> = {...DEFAULT_DETECT_MODE};

// LRU 캐시 - 정규식 컴파일 누수 방지
const regexCache = new LRUCache<string, RegExp>(500);

export const isBlockEntry = (value: unknown): value is BlockEntry => {
    if (!value || typeof value !== "object") return false;

    const entry = value as Partial<BlockEntry>;
    return (
        typeof entry.content === "string" &&
        typeof entry.isRegex === "boolean" &&
        (entry.gallery === undefined || typeof entry.gallery === "string") &&
        (entry.extra === undefined || typeof entry.extra === "string") &&
        (entry.mode === undefined || (DETECT_MODES as string[]).includes(entry.mode))
    );
};

export const normalizeBlockList = (value: unknown): BlockEntry[] => {
    if (typeof value === "string") {
        try {
            return normalizeBlockList(JSON.parse(value));
        } catch {
            return [];
        }
    }

    if (!Array.isArray(value)) return [];

    return value.filter(isBlockEntry).map((entry) => ({
        ...entry,
        id: typeof entry.id === "string" ? entry.id : crypto.randomUUID()
    }));
};

const getCompiledRegex = (pattern: string): RegExp | null => {
    const cached = regexCache.get(pattern);
    if (cached) return cached;

    try {
        const regex = new RegExp(pattern);
        regexCache.set(pattern, regex);
        return regex;
    } catch {
        return null;
    }
};

const checkValidType = (type: string): type is BlockType => (BLOCK_TYPES as string[]).includes(type);

/**
 * 해당 내용이 차단될 내용인지를 반환합니다.
 *
 * @param type 차단 종류
 * @param content 확인할 내용
 * @param gallery 현재 갤러리
 */
export const check = (type: BlockType, content: string, gallery?: string): boolean => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${BLOCK_TYPES.join(", ")}]`);
    if (!content) return false;

    return caches[type].some((entry) => {
        if (entry.gallery && entry.gallery !== gallery) return false;

        const mode = entry.mode ?? defaults[type];

        if (entry.isRegex) {
            const regex = getCompiledRegex(entry.content);
            if (!regex) return false;
            const matched = content.match(regex);

            switch (mode) {
                case "SAME":
                    return matched?.[0] === content;
                case "CONTAIN":
                    return matched !== null;
                case "NOT_SAME":
                    return matched?.[0] !== content;
                case "NOT_CONTAIN":
                    return matched === null;
            }
        }

        switch (mode) {
            case "SAME":
                return entry.content === content;
            case "CONTAIN":
                return content.includes(entry.content);
            case "NOT_SAME":
                return entry.content !== content;
            case "NOT_CONTAIN":
                return !content.includes(entry.content);
        }
    });
};

/**
 * obj에 있는 모든 키 값들이 차단 목록에 있는지 검사합니다.
 *
 * @param obj 검사할 객체
 * @param gallery 갤러리 이름 (선택)
 */
export const checkAll = (obj: Partial<Record<BlockType, string | null>>, gallery?: string): boolean => {
    for (const [key, value] of Object.entries(obj)) {
        if (value && check(key as BlockType, value, gallery)) return true;
    }

    return false;
};

export interface BlockInput {
    content: string;
    isRegex: boolean;
    mode?: DetectMode;
    gallery?: string;
    extra?: string;
}

/** 차단 목록에 추가. 같은 content+gallery가 있으면 교체 */
export const add = async (type: BlockType, input: BlockInput): Promise<BlockEntry> => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${BLOCK_TYPES.join(", ")}]`);
    if (input.mode && !(DETECT_MODES as string[]).includes(input.mode))
        throw new Error(`${input.mode} is not a valid mode. requires one of [${DETECT_MODES.join(", ")}]`);

    const list = caches[type].filter(
        (entry) => !(entry.content === input.content && (entry.gallery ?? "") === (input.gallery ?? ""))
    );

    const entry: BlockEntry = {id: crypto.randomUUID(), ...input};
    list.push(entry);

    caches[type] = list;
    await blockStorage[type].setValue(list);

    return entry;
};

export const remove = async (type: BlockType, id: string): Promise<void> => {
    caches[type] = caches[type].filter((entry) => entry.id !== id);
    await blockStorage[type].setValue(caches[type]);
};

export const update = async (type: BlockType, id: string, input: Partial<BlockInput> & {content: string; isRegex: boolean}): Promise<void> => {
    const list = caches[type].filter((entry) => entry.id !== id && !(entry.content === input.content && (entry.gallery ?? "") === (input.gallery ?? "")));

    const current = caches[type].find((entry) => entry.id === id);
    if (!current) return;

    list.push({...current, ...input, id});
    caches[type] = list;
    await blockStorage[type].setValue(list);
};

export const clear = async (type: BlockType): Promise<void> => {
    caches[type] = [];
    await blockStorage[type].setValue([]);
};

export const setDefaultMode = async (type: BlockType, mode: DetectMode): Promise<void> => {
    defaults[type] = mode;
    await blockDefaultsStorage.setValue({...defaults});
};

export const block = {
    check,
    checkAll,
    add,
    remove,
    update,
    clear,
    setDefaultMode
};

export type {BlockType};

let initialized = false;

/** 캐시 초기화 + 변경 감시. 콘텐츠/팝업 각 1회 */
export const init = (): Promise<void> => {
    if (initialized) return Promise.resolve();
    initialized = true;

    return (async () => {
        await Promise.all(
            BLOCK_TYPES.map(async (type) => {
                caches[type] = normalizeBlockList(await blockStorage[type].getValue());

                blockStorage[type].watch((next) => {
                    if (next) caches[type] = normalizeBlockList(next);
                });
            })
        );

        const storedDefaults = await blockDefaultsStorage.getValue();
        if (storedDefaults) Object.assign(defaults, storedDefaults);

        blockDefaultsStorage.watch((next) => {
            if (next) Object.assign(defaults, next);
        });
    })();
};
