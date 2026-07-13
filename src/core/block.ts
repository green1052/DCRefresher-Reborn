import {BLOCK_TYPES, blockModeStorage, blockStorage} from "@/storage/wxtStorage";
import {eventBus} from "./eventbus";

export const TYPE_NAMES: Record<RefresherBlockType, string> = {
    NICK: "닉네임",
    ID: "아이디",
    IP: "IP",
    TITLE: "제목",
    TEXT: "내용",
    COMMENT: "댓글",
    DCCON: "디시콘",
    TAB: "말머리"
};

export const BLOCK_DETECT_MODE_TYPE_NAMES: Record<RefresherBlockDetectMode, string> = {
    SAME: "일치",
    CONTAIN: "포함",
    NOT_SAME: "불일치",
    NOT_CONTAIN: "불포함"
};

const BLOCK_DETECT_MODE: ObjectEnum<RefresherBlockDetectMode> = {
    SAME: "SAME",
    CONTAIN: "CONTAIN",
    NOT_SAME: "NOT_SAME",
    NOT_CONTAIN: "NOT_CONTAIN"
};

const BLOCK_DETECT_MODE_KEYS = Object.keys(BLOCK_DETECT_MODE) as RefresherBlockDetectMode[];

export type BlockCache = Record<RefresherBlockType, RefresherBlockValue[]>;

export type BlockModeCache = Record<RefresherBlockType, RefresherBlockDetectMode>;

const regexCache = new Map<string, RegExp>();
const advancedFnCache = new Map<string, (...args: unknown[]) => unknown>();

const clearCompiledCaches = (): void => {
    regexCache.clear();
    advancedFnCache.clear();
};

const getCompiledRegex = (pattern: string): RegExp | null => {
    let regex = regexCache.get(pattern);
    if (regex) return regex;
    try {
        regex = new RegExp(pattern);
    } catch {
        return null;
    }
    regexCache.set(pattern, regex);
    return regex;
};

const getCompiledAdvancedFn = (content: string): ((...args: unknown[]) => unknown) | null => {
    let fn = advancedFnCache.get(content);
    if (fn) return fn;
    try {
        fn = new Function("type", "content", "gallery", content) as (...args: unknown[]) => unknown;
    } catch {
        return null;
    }
    advancedFnCache.set(content, fn);
    return fn;
};

let blockCache: BlockCache = {
    NICK: [],
    ID: [],
    IP: [],
    TITLE: [],
    TEXT: [],
    COMMENT: [],
    DCCON: [],
    TAB: []
};

let blockModeCache: BlockModeCache = {
    NICK: BLOCK_DETECT_MODE.SAME,
    ID: BLOCK_DETECT_MODE.SAME,
    IP: BLOCK_DETECT_MODE.SAME,
    TITLE: BLOCK_DETECT_MODE.CONTAIN,
    TEXT: BLOCK_DETECT_MODE.CONTAIN,
    COMMENT: BLOCK_DETECT_MODE.CONTAIN,
    DCCON: BLOCK_DETECT_MODE.SAME,
    TAB: BLOCK_DETECT_MODE.SAME
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
        (blockValue.mode === undefined || checkValidMode(blockValue.mode))
    );
};

const normalizeBlockList = (value: unknown): RefresherBlockValue[] => {
    if (typeof value === "string") {
        try {
            return normalizeBlockList(JSON.parse(value));
        } catch {
            return [];
        }
    }

    return Array.isArray(value) ? value.filter(isBlockValue) : [];
};

const normalizeBlockMode = (
    value: unknown,
    fallback: RefresherBlockDetectMode
): RefresherBlockDetectMode => {
    if (typeof value === "string") {
        if (BLOCK_DETECT_MODE_KEYS.includes(value as RefresherBlockDetectMode)) {
            return value as RefresherBlockDetectMode;
        }

        try {
            return normalizeBlockMode(JSON.parse(value), fallback);
        } catch {
            return fallback;
        }
    }

    return fallback;
};

// Initialize cache and watchers from wxt/storage
(async () => {
    for (const key of BLOCK_TYPES) {
        // Initial load
        const storedBlocks = normalizeBlockList(await blockStorage[key].getValue());
        const storedMode = normalizeBlockMode(
            await blockModeStorage[key].getValue(),
            blockModeCache[key]
        );

        blockCache[key] = storedBlocks;
        blockModeCache[key] = storedMode;

        // Watch for changes
        blockStorage[key].watch((newValue) => {
            if (!newValue) return;
            blockCache[key] = normalizeBlockList(newValue);
            clearCompiledCaches();
            eventBus.emit("refresh");
        });

        blockModeStorage[key].watch((newValue) => {
            if (!newValue) return;
            blockModeCache[key] = normalizeBlockMode(newValue, blockModeCache[key]);
            eventBus.emit("refresh");
        });
    }
})();

const checkValidType = (type: string) => {
    return BLOCK_TYPES.some((key) => key === type);
};

const checkValidMode = (mode: string) => {
    return Object.keys(BLOCK_DETECT_MODE).some((key) => mode === key);
};

const removeExists = (type: RefresherBlockType, content: string) => {
    blockCache[type] = normalizeBlockList(blockCache[type]).filter((value) => value.content !== content);
};

// Internal update helpers now just update storage. The watcher updates local cache.
// However, to keep synchronous operations working smoothly (avoid race conditions in same context),
// we update local cache immediately as well.
const InternalAddToList = async (
    type: RefresherBlockType,
    content: string,
    isRegex: boolean,
    isAdvanced: boolean,
    gallery?: string,
    extra?: string,
    mode?: RefresherBlockDetectMode
) => {
    removeExists(type, content);

    const newItem: RefresherBlockValue = {
        content,
        isRegex,
        isAdvanced,
        gallery,
        extra,
        mode
    };

    blockCache[type] = normalizeBlockList(blockCache[type]);
    blockCache[type].push(newItem);
    clearCompiledCaches();

    await blockStorage[type].setValue(blockCache[type]);
};

const InternalUpdateMode = async (type: RefresherBlockType, mode: RefresherBlockDetectMode) => {
    blockModeCache[type] = mode;
    await blockModeStorage[type].setValue(mode);
};

/**
 * 차단 목록에 추가합니다.
 *
 * @param type 차단 종류
 * @param content 차단 내용
 * @param isRegex 정규식인지에 대한 여부
 * @param isAdvanced 고급 차단인지에 대한 여부
 * @param gallery 특정 갤러리에만 해당하면 갤러리의 ID 값
 * @param extra 차단 목록에서의 식별을 위한 추가 값
 * @param mode 차단 모드
 */
export const add = (
    type: RefresherBlockType,
    content: string,
    isRegex: boolean,
    isAdvanced: boolean,
    gallery?: string,
    extra?: string,
    mode?: RefresherBlockDetectMode
): Promise<void> => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${BLOCK_TYPES.join(", ")}]`);

    if (mode && !checkValidMode(mode))
        throw new Error(`${mode} is not a valid mode. requires one of [${BLOCK_DETECT_MODE_KEYS.join(", ")}]`);

    return InternalAddToList(type, content, isRegex, isAdvanced, gallery, extra, mode);
};

/**
 * 주어진 type의 차단의 모드를 변경합니다.
 *
 * @param type 차단 종류
 * @param mode 차단 모드
 */
export const updateMode = (type: RefresherBlockType, mode: RefresherBlockDetectMode): Promise<void> => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${BLOCK_TYPES.join(", ")}]`);

    if (!checkValidMode(mode))
        throw new Error(`${mode} is not a valid mode. requires one of [${BLOCK_DETECT_MODE_KEYS.join(", ")}]`);

    return InternalUpdateMode(type, mode);
};

/**
 * 해당 내용이 차단될 내용인지를 반환합니다.
 *
 * @param type 차단 종류
 * @param content 확인할 내용
 * @param gallery 현재 갤러리
 */
export const check = (type: RefresherBlockType, content: string, gallery?: string): boolean => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${BLOCK_TYPES.join(", ")}]`);

    if (!content || content.length < 1) return false;

    const cache = blockCache[type];

    if (!cache || cache.length < 1) return false;

    const result = cache.some((v) => {
        if (v.gallery && v.gallery !== gallery) return false;

        if (v.isAdvanced) {
            const fn = getCompiledAdvancedFn(v.content);
            if (!fn) return false;
            try {
                const response = fn(type, content, gallery);
                return typeof response === "boolean" ? response : false;
            } catch {
                return false;
            }
        }

        const mode = v.mode ?? blockModeCache[type];

        if (v.isRegex) {
            const regexd = getCompiledRegex(v.content);
            if (!regexd) return false;
            const match = content.match(regexd);

            switch (mode) {
                case BLOCK_DETECT_MODE.SAME:
                    return match?.[0] === content;
                case BLOCK_DETECT_MODE.CONTAIN:
                    return match !== null;
                case BLOCK_DETECT_MODE.NOT_SAME:
                    return match?.[0] !== content;
                case BLOCK_DETECT_MODE.NOT_CONTAIN:
                    return match === null;
            }
        }

        switch (mode) {
            case BLOCK_DETECT_MODE.SAME:
                return v.content === content;
            case BLOCK_DETECT_MODE.CONTAIN:
                return content.includes(v.content);
            case BLOCK_DETECT_MODE.NOT_SAME:
                return v.content !== content;
            case BLOCK_DETECT_MODE.NOT_CONTAIN:
                return !content.includes(v.content);
        }
    });

    return result;
};

/**
 * obj에 있는 모든 키 값들이 차단 목록에 있는지 검사합니다.
 *
 * @param obj 검사할 객체
 * @param gallery 갤러리 이름 (선택)
 */
export const checkAll = (obj: Partial<Record<RefresherBlockType, string | null>>, gallery?: string): boolean => {
    for (const [key, value] of Object.entries(obj)) {
        if (value && check(key as RefresherBlockType, String(value), gallery)) return true;
    }

    return false;
};

/**
 * 차단 모드를 구합니다.
 */
export const getBlockMode = (type: RefresherBlockType) => {
    return blockModeCache[type];
};

export default {
    TYPE_NAMES,
    BLOCK_DETECT_MODE_TYPE_NAMES,
    add,
    updateMode,
    check,
    checkAll,
    getBlockMode
};
