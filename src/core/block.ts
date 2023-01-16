import storage from "../utils/storage";
import {eventBus} from "./eventbus";
import log from "../utils/logger";
import browser from "webextension-polyfill";

import * as communicate from "./communicate";

const BLOCK_NAMESPACE = "__REFRESHER_BLOCK";

const BLOCK_TYPES: {
    [key in RefresherBlockType]: RefresherBlockType;
} = {
    NICK: "NICK",
    ID: "ID",
    IP: "IP",
    TITLE: "TITLE",
    TEXT: "TEXT",
    COMMENT: "COMMENT",
    DCCON: "DCCON"
};

/**
 * 타입의 이름을 저장한 객체입니다.
 */
export const TYPE_NAMES = {
    NICK: "닉네임",
    ID: "아이디",
    IP: "IP",
    TITLE: "제목",
    TEXT: "내용",
    COMMENT: "댓글",
    DCCON: "디시콘"
};

const BLOCK_TYPES_KEYS = Object.keys(BLOCK_TYPES) as RefresherBlockType[];

export const BLOCK_DETECT_MODE: { [key in RefresherBlockDetectMode]: RefresherBlockDetectMode } = {
    SAME: "SAME",
    CONTAIN: "CONTAIN",
    NOT_SAME: "NOT_SAME",
    NOT_CONTAIN: "NOT_CONTAIN"
};

export const BLOCK_DETECT_MODE_TYPE_NAMES = {
    SAME: "일치",
    CONTAIN: "포함",
    NOT_SAME: "불일치",
    NOT_CONTAIN: "불포함"
};

const BLOCK_DETECT_MODE_KEYS = Object.keys(BLOCK_DETECT_MODE);

export type BlockCache = {
    [index in RefresherBlockType]: RefresherBlockValue[];
}

export type BlockModeCache = {
    [index in RefresherBlockType]: RefresherBlockDetectMode;
}

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
    DCCON: []
};
let BLOCK_MODE_CACHE: BlockModeCache = {
    NICK: BLOCK_DETECT_MODE.SAME,
    ID: BLOCK_DETECT_MODE.SAME,
    IP: BLOCK_DETECT_MODE.SAME,
    TITLE: BLOCK_DETECT_MODE.CONTAIN,
    TEXT: BLOCK_DETECT_MODE.CONTAIN,
    COMMENT: BLOCK_DETECT_MODE.CONTAIN,
    DCCON: BLOCK_DETECT_MODE.SAME
};

BLOCK_TYPES_KEYS.forEach(async (key) => {
    const keyCache = await storage.get<RefresherBlockValue[]>(`${BLOCK_NAMESPACE}:${key}`);
    const modeCache = await storage.get<RefresherBlockDetectMode>(`${BLOCK_NAMESPACE}:${key}:MODE`);

    BLOCK_CACHE[key] = keyCache ?? [];
    BLOCK_MODE_CACHE[key] = modeCache ?? BLOCK_MODE_CACHE[key];

    if (!modeCache) {
        await storage.set(`${BLOCK_NAMESPACE}:${key}:MODE`, BLOCK_MODE_CACHE[key]);
    }

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

    if (!cache) {
        return;
    }

    for (let i = 0; i < cache.length; i++) {
        if (cache[i].content === content) {
            BLOCK_CACHE[type].splice(i, 1);
        }
    }
};

const InternalAddToList = (
    type: RefresherBlockType,
    content: string,
    isRegex: boolean,
    gallery?: string,
    extra?: string,
    mode?: RefresherBlockDetectMode
) => {
    removeExists(type, content);

    BLOCK_CACHE[type].push({
        content,
        isRegex,
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
): void => {
    if (!checkValidType(type)) {
        throw `${type} is not a valid type. requires one of [${BLOCK_TYPES_KEYS.join(", ")}]`;
    }

    if (mode !== undefined && !checkValidMode(mode)) {
        throw `${mode} is not a valid mode. requires one of [${BLOCK_DETECT_MODE_KEYS.join(", ")}]`;
    }

    InternalAddToList(type, content, isRegex, gallery, extra, mode);

    try {
        SendToBackground();
    } catch (e) {
        log(`Failed to send to background context. ${e}`);
    }
};

/**
 * 주어진 type의 차단의 모드를 변경합니다.
 *
 * @param type 차단 종류
 * @param mode 차단 모드
 */
export const updateMode = (type: RefresherBlockType, mode: RefresherBlockDetectMode): void => {
    if (!checkValidType(type)) {
        throw `${type} is not a valid type. requires one of [${BLOCK_TYPES_KEYS.join(", ")}]`;
    }

    if (!checkValidMode(mode)) {
        throw `${type} is not a valid type. requires one of [${BLOCK_DETECT_MODE_KEYS.join(", ")}]`;
    }

    InternalUpdateMode(type, mode);
};

/**
 * 해당 내용이 차단될 내용인지를 반환합니다.
 *
 * @param type 차단 종류
 * @param content 확인할 내용
 * @param gallery 현재 갤러리
 */
export const check = (
    type: RefresherBlockType,
    content: string,
    gallery?: string
): boolean => {
    if (!checkValidType(type)) {
        throw `${type} is not a valid type. requires one of [${BLOCK_TYPES_KEYS.join(", ")}]`;
    }

    if (!content || content.length < 1) {
        return false;
    }


    if (!BLOCK_CACHE[type] || BLOCK_CACHE[type].length < 1) {
        return false;
    }

    const result = BLOCK_CACHE[type].filter((v) => {
        const mode = v.mode ?? BLOCK_MODE_CACHE[type];

        if (v.gallery && v.gallery !== gallery) {
            return false;
        }

        if (v.isRegex) {
            const regexd = new RegExp(v.content);
            const match = content.match(regexd);

            if (mode === BLOCK_DETECT_MODE.SAME) {
                return match && match[0] === content;
            } else if (mode === BLOCK_DETECT_MODE.CONTAIN) {
                return regexd.test(content);
            } else if (mode === BLOCK_DETECT_MODE.NOT_SAME) {
                return !match || match[0] !== content;
            } else if (mode === BLOCK_DETECT_MODE.NOT_CONTAIN) {
                return !regexd.test(content);
            }

            return false;
        }

        if (mode === BLOCK_DETECT_MODE.SAME) {
            return v.content === content;
        } else if (mode === BLOCK_DETECT_MODE.CONTAIN) {
            return content.includes(v.content);
        } else if (mode === BLOCK_DETECT_MODE.NOT_SAME) {
            return v.content !== content;
        } else if (mode === BLOCK_DETECT_MODE.NOT_CONTAIN) {
            return !content.includes(v.content);
        }

        return false;
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
    obj: { [index in RefresherBlockType]?: string },
    gallery?: string
): boolean => {
    let block = false;

    for (const key of Object.keys(obj)) {
        if (block) break;

        if (check(key as RefresherBlockType, obj[key as RefresherBlockType] as string, gallery)) {
            block = true;
        }
    }

    return block;
};

/**
 * 데이터를 저장합니다. (내부)
 *
 * @param store
 * @param mode
 */
export const setStore = (
    store: BlockCache,
    mode: BlockModeCache
): void => {
    BLOCK_CACHE = store;
    BLOCK_MODE_CACHE = mode;
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

communicate.addHook("updateBlocks", (data) => {
    setStore(data.blocks, data.modes);
});

requestAnimationFrame(async () => {
    storage.get("refresher.blockQueue").then((value) => {
        if (!(value as string[]).length) {
            return;
        }

        for (let i = 0; i < (value as string[]).length; i++) {
            const dccon = (value as string[])[i];

            InternalAddToList("DCCON", dccon as string, false);
        }
    });

    storage.set("refresher.blockQueue", []);
});