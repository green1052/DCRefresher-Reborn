import {BLOCK_TYPES, blockModeStorage, blockStorage} from "@/storage/wxtStorage";
import {LRUCache} from "@/utils/lruCache";

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

type BlockCache = Record<RefresherBlockType, RefresherBlockValue[]>;

type BlockModeCache = Record<RefresherBlockType, RefresherBlockDetectMode>;

// LRU 캐시 - 최대 500개 항목으로 메모리 누수 방지
const MAX_CACHE_SIZE = 500;
const regexCache = new LRUCache<string, RegExp>(MAX_CACHE_SIZE);

const clearCompiledCaches = (): void => {
    regexCache.clear();
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
        (blockValue.gallery === undefined || typeof blockValue.gallery === "string") &&
        (blockValue.extra === undefined || typeof blockValue.extra === "string") &&
        (blockValue.mode === undefined || checkValidMode(blockValue.mode))
    );
};

export const normalizeBlockList = (value: unknown): RefresherBlockValue[] => {
    if (typeof value === "string") {
        try {
            return normalizeBlockList(JSON.parse(value));
        } catch {
            return [];
        }
    }

    return Array.isArray(value) ? value.filter(isBlockValue) : [];
};

export const normalizeBlockMode = (
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

// 차단 목록/모드 스토리지의 초기 로드 + 변경 감시를 등록한다.
// 콘텐츠 스크립트(core/block.ts)와 팝업(useBlocks)이 같은 로직을 공유한다.
// 반환값: 감시 해제 함수 (팝업 등 이중 등록 방지용 클린업).
export const watchBlockStorages = (
    onList: (type: RefresherBlockType, blocks: RefresherBlockValue[]) => void,
    onMode: (type: RefresherBlockType, mode: RefresherBlockDetectMode) => void
): (() => void) => {
    const unwatchers: (() => void)[] = [];

    for (const type of BLOCK_TYPES) {
        void blockStorage[type].getValue().then((value) => onList(type, normalizeBlockList(value)));
        unwatchers.push(blockStorage[type].watch((value) => onList(type, normalizeBlockList(value))));

        void blockModeStorage[type].getValue().then((value) => onMode(type, normalizeBlockMode(value, "SAME")));
        unwatchers.push(blockModeStorage[type].watch((value) => onMode(type, normalizeBlockMode(value, "SAME"))));
    }

    return () => {
        for (const unwatch of unwatchers) unwatch();
    };
};

// Initialize cache and watchers from wxt/storage
watchBlockStorages(
    (type, blocks) => {
        blockCache[type] = blocks;
        clearCompiledCaches();
    },
    (type, mode) => {
        blockModeCache[type] = mode;
    }
);

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
const internalAddToList = async (
    type: RefresherBlockType,
    content: string,
    isRegex: boolean,
    gallery?: string,
    extra?: string,
    mode?: RefresherBlockDetectMode
) => {
    removeExists(type, content);

    const newItem: RefresherBlockValue = {
        content,
        isRegex,
        gallery,
        extra,
        mode
    };

    blockCache[type] = normalizeBlockList(blockCache[type]);
    blockCache[type].push(newItem);
    clearCompiledCaches();

    await blockStorage[type].setValue(blockCache[type]);
};

/**
 * 차단 목록에 추가합니다.
 *
 * @param type 차단 종류
 * @param content 차단 내용
 * @param isRegex 정규식인지에 대한 여부
 * @param gallery 특정 갤러리에만 해당하면 갤러리의 ID 값
 * @param extra 차단 목록에서의 식별을 위한 추가 값
 * @param mode 차단 모드
 */
export const add = (
    type: RefresherBlockType,
    content: string,
    isRegex: boolean,
    gallery?: string,
    extra?: string,
    mode?: RefresherBlockDetectMode
): Promise<void> => {
    if (!checkValidType(type)) throw new Error(`${type} is not a valid type. requires one of [${BLOCK_TYPES.join(", ")}]`);

    if (mode && !checkValidMode(mode))
        throw new Error(`${mode} is not a valid mode. requires one of [${BLOCK_DETECT_MODE_KEYS.join(", ")}]`);

    return internalAddToList(type, content, isRegex, gallery, extra, mode);
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

export default {
    TYPE_NAMES,
    BLOCK_DETECT_MODE_TYPE_NAMES,
    add,
    check,
    checkAll
};
