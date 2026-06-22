import {memoStorage} from "../utils/storage";
import communicate from "./communicate";
import eventBus from "./eventbus";

/**
 * 타입의 이름을 저장한 객체입니다.
 */
export const TYPE_NAMES = {
    UID: "유저 ID",
    NICK: "닉네임",
    IP: "IP"
};

const MEMO_TYPES_KEYS: RefresherMemoType[] = ["UID", "NICK", "IP"];

export type MemoCache = Record<RefresherMemoType, Record<string, RefresherMemoValue>>;

let MEMO_CACHE: MemoCache = {
    UID: {},
    NICK: {},
    IP: {}
};

const isMemoValue = (value: unknown): value is RefresherMemoValue => {
    if (!value || typeof value !== "object") return false;

    const memoValue = value as Partial<RefresherMemoValue>;
    return (
        typeof memoValue.text === "string" &&
        typeof memoValue.color === "string" &&
        (memoValue.gallery === undefined || typeof memoValue.gallery === "string")
    );
};

const normalizeMemoMap = (value: unknown): Record<string, RefresherMemoValue> => {
    if (typeof value === "string") {
        try {
            return normalizeMemoMap(JSON.parse(value));
        } catch {
            return {};
        }
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(Object.entries(value).filter(([, memo]) => isMemoValue(memo)));
};

(async () => {
    for (const key of MEMO_TYPES_KEYS) {
        const memo = await memoStorage[key].getValue();
        MEMO_CACHE[key] = normalizeMemoMap(memo);

        memoStorage[key].watch((newValue) => {
            MEMO_CACHE[key] = normalizeMemoMap(newValue);
            eventBus.emit("refresh");
        });
    }
})();

const InternalAddToList = async (type: RefresherMemoType, user: string, text: string, color: string, gallery?: string) => {
    MEMO_CACHE[type][user] = {
        text,
        color,
        gallery
    };

    await memoStorage[type].setValue({...MEMO_CACHE[type]});
};

const checkValidType = (type: string) => MEMO_TYPES_KEYS.some((key) => key === type);

/**
 * 메모 목록에 추가합니다.
 *
 * @param type 메모 종류
 * @param user 유저
 * @param text 메모 내용
 * @param color 메모 색상
 * @param gallery 특정 갤러리에만 해당하면 갤러리의 ID 값
 */
export const add = (type: RefresherMemoType, user: string, text: string, color: string, gallery?: string): void => {
    if (!checkValidType(type)) {
        throw new Error(`${type} is not a valid mode. requires one of [${MEMO_TYPES_KEYS.join(", ")}]`);
    }

    InternalAddToList(type, user, text, color, gallery);
};

/**
 * 메모 내용을 구합니다.
 *
 * @param type 메모 종류
 * @param user 유저
 */
export const get = (type: RefresherMemoType, user: string): RefresherMemoValue => {
    if (!checkValidType(type)) {
        throw new Error(`${type} is not a valid mode. requires one of [${MEMO_TYPES_KEYS.join(", ")}]`);
    }

    return MEMO_CACHE[type][user];
};

/**
 * 메모를 삭제합니다.
 *
 * @param type 메모 종류
 * @param user 유저
 */
export const remove = async (type: RefresherMemoType, user: string): Promise<void> => {
    if (!checkValidType(type)) {
        throw new Error(`${type} is not a valid mode. requires one of [${MEMO_TYPES_KEYS.join(", ")}]`);
    }

    delete MEMO_CACHE[type][user];
    await memoStorage[type].setValue({...MEMO_CACHE[type]});
};

communicate.addHook("memoSelected", () => {
    eventBus.emit("refresherUpdateUserMemo");
});


export default {
    TYPE_NAMES,
    add,
    get,
    remove
};
