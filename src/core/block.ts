import * as communicate from "./communicate";
import { eventBus } from "./eventbus";
import storage from "../utils/storage";
import browser from "webextension-polyfill";
import type { ObjectEnum } from "../utils/types";

const BLOCK_NAMESPACE = "__REFRESHER_BLOCK";

/**
 * 타입의 이름을 저장한 객체입니다.
 */
export const TYPE_NAMES: Record<RefresherBlockType, string> = {
    NICK: "닉네임",
    ID: "아이디",
    IP: "IP",
    TITLE: "제목",
    TEXT: "내용",
    COMMENT: "댓글",
    DCCON: "디시콘",
    TAB: "말머리",
    IMAGE: "이미지 (미구현)"
};

const BLOCK_TYPES_KEYS: RefresherBlockType[] = [
    "NICK",
    "ID",
    "IP",
    "TITLE",
    "TEXT",
    "COMMENT",
    "DCCON",
    "TAB",
    "IMAGE"
];

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

function SendToBackground() {
    browser.runtime.sendMessage(
        JSON.stringify({
            blocks_store: BLOCK_CACHE,
            blockModes_store: BLOCK_MODE_CACHE
        })
    );
}

let BLOCK_CACHE: BlockCache = {
    NICK: [],
    ID: [],
    IP: [],
    TITLE: [],
    TEXT: [],
    COMMENT: [],
    DCCON: [],
    TAB: [],
    IMAGE: []
};

let BLOCK_MODE_CACHE: BlockModeCache = {
    NICK: BLOCK_DETECT_MODE.SAME,
    ID: BLOCK_DETECT_MODE.SAME,
    IP: BLOCK_DETECT_MODE.SAME,
    TITLE: BLOCK_DETECT_MODE.CONTAIN,
    TEXT: BLOCK_DETECT_MODE.CONTAIN,
    COMMENT: BLOCK_DETECT_MODE.CONTAIN,
    DCCON: BLOCK_DETECT_MODE.SAME,
    TAB: BLOCK_DETECT_MODE.SAME,
    IMAGE: BLOCK_DETECT_MODE.SAME
};

BLOCK_TYPES_KEYS.forEach(async (key) => {
    const keyCache = await storage.get<RefresherBlockValue[]>(`${BLOCK_NAMESPACE}:${key}`);
    const modeCache = await storage.get<RefresherBlockDetectMode>(`${BLOCK_NAMESPACE}:${key}:MODE`);

    BLOCK_CACHE[key] = keyCache ?? [];
    BLOCK_MODE_CACHE[key] = modeCache ?? BLOCK_MODE_CACHE[key];

    if (!modeCache) await storage.set(`${BLOCK_NAMESPACE}:${key}:MODE`, BLOCK_MODE_CACHE[key]);

    SendToBackground();
});

const checkValidType = (type: string) => {
    return BLOCK_TYPES_KEYS.some((key) => key === type);
};

const checkValidMode = (mode: string) => {
    return Object.keys(BLOCK_DETECT_MODE).some((key) => mode === key);
};

const removeExists = (type: RefresherBlockType, content: string) => {
    const cache = BLOCK_CACHE[type];

    if (!cache) return;

    BLOCK_CACHE[type] = cache.filter((value) => value.content !== content);
};

const InternalAddToList = (
    type: RefresherBlockType,
    content: string,
    isRegex: boolean,
    isAdvanced: boolean,
    gallery?: string,
    extra?: string,
    mode?: RefresherBlockDetectMode
) => {
    removeExists(type, content);

    BLOCK_CACHE[type].push({
        content,
        isRegex,
        isAdvanced,
        gallery,
        extra,
        mode
    });

    storage.set(`${BLOCK_NAMESPACE}:${type}`, BLOCK_CACHE[type]);
};

const InternalUpdateMode = (type: RefresherBlockType, mode: RefresherBlockDetectMode) => {
    BLOCK_MODE_CACHE[type] = mode;

    storage.set(`${BLOCK_NAMESPACE}:${type}:MODE`, mode);
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
): void => {
    if (!checkValidType(type))
        throw `${type} is not a valid type. requires one of [${BLOCK_TYPES_KEYS.join(", ")}]`;

    if (mode && !checkValidMode(mode))
        throw `${mode} is not a valid mode. requires one of [${BLOCK_DETECT_MODE_KEYS.join(", ")}]`;

    InternalAddToList(type, content, isRegex, isAdvanced, gallery, extra, mode);

    try {
        SendToBackground();
    } catch (e) {
        console.log(`Failed to send to background context. ${e}`);
    }
};

/**
 * 주어진 type의 차단의 모드를 변경합니다.
 *
 * @param type 차단 종류
 * @param mode 차단 모드
 */
export const updateMode = (type: RefresherBlockType, mode: RefresherBlockDetectMode): void => {
    if (!checkValidType(type))
        throw `${type} is not a valid type. requires one of [${BLOCK_TYPES_KEYS.join(", ")}]`;

    if (!checkValidMode(mode))
        throw `${type} is not a valid type. requires one of [${BLOCK_DETECT_MODE_KEYS.join(", ")}]`;

    InternalUpdateMode(type, mode);
};

/**
 * 해당 내용이 차단될 내용인지를 반환합니다.
 *
 * @param type 차단 종류
 * @param content 확인할 내용
 * @param gallery 현재 갤러리
 */
export const check = (type: RefresherBlockType, content: string, gallery?: string): boolean => {
    if (!checkValidType(type))
        throw `${type} is not a valid type. requires one of [${BLOCK_TYPES_KEYS.join(", ")}]`;

    if (!content || content.length < 1) return false;

    if (!BLOCK_CACHE[type] || BLOCK_CACHE[type].length < 1) return false;

    const result = BLOCK_CACHE[type].filter((v) => {
        if (v.gallery && v.gallery !== gallery) return false;

        if (v.isAdvanced) {
            const response = new Function("type", "content", "gallery", v.content)(
                type,
                content,
                gallery
            );
            return typeof response === "boolean" ? response : false;
        }

        const mode = v.mode ?? BLOCK_MODE_CACHE[type];

        if (v.isRegex) {
            const regexd = new RegExp(v.content);
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

    return result.length > 0;
};

/**
 * obj에 있는 모든 키 값들이 차단 목록에 있는지 검사합니다.
 *
 * @param obj 검사할 객체
 * @param gallery 갤러리 이름 (선택)
 */
export const checkAll = (
    obj: Partial<Record<RefresherBlockType, string | null>>,
    gallery?: string
): boolean => {
    for (const [key, value] of Object.entries(obj)) {
        if (value && check(key as RefresherBlockType, String(value), gallery)) return true;
    }

    return false;
};

/**
 * 데이터를 저장합니다. (내부)
 *
 * @param store
 * @param mode
 */
export const setStore = (store: BlockCache, mode: BlockModeCache): void => {
    BLOCK_CACHE = store;

    for (const [key, value] of Object.entries(store)) {
        for (const block of value) {
            InternalAddToList(
                key as RefresherBlockType,
                block.content,
                block.isRegex,
                block.isAdvanced,
                block.gallery,
                block.extra,
                block.mode
            );
        }
    }

    BLOCK_MODE_CACHE = mode;

    for (const [key, value] of Object.entries(mode)) {
        InternalUpdateMode(key as RefresherBlockType, value);
    }
};

/**
 * 차단 모드를 구합니다.
 */
export const getBlockMode = (type: RefresherBlockType) => {
    return BLOCK_MODE_CACHE[type];
};

communicate.addHook("blockSelected", () => {
    eventBus.emit("refresherRequestBlock");
});

communicate.addHook("dcconSelected", () => {
    eventBus.emit("refresherRequestBlock");
});

communicate.addHook("dcconAllSelected", () => {
    eventBus.emit("refresherRequestBlock", { blockAllDccon: true });
});

communicate.addHook("updateBlocks", (data) => {
    setStore(data.blocks, data.modes);
});

requestAnimationFrame(async () => {
    storage.get<string[]>("refresher.blockQueue").then((value) => {
        for (const dccon of value) {
            InternalAddToList("DCCON", dccon, false, false);
        }
    });

    storage.set("refresher.blockQueue", []);
});
