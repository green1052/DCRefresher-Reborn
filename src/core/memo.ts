import {MEMO_TYPES, memoStorage} from "../utils/storage";
import communicate from "./communicate";
import eventBus from "./eventbus";

export const TYPE_NAMES = {
    UID: "유저 ID",
    NICK: "닉네임",
    IP: "IP"
};

export type MemoCache = Record<RefresherMemoType, Record<string, RefresherMemoValue>>;

let memoCache: MemoCache = {
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
    for (const key of MEMO_TYPES) {
        const memo = await memoStorage[key].getValue();
        memoCache[key] = normalizeMemoMap(memo);

        memoStorage[key].watch((newValue) => {
            memoCache[key] = normalizeMemoMap(newValue);
            eventBus.emit("refresh");
        });
    }
})();

const InternalAddToList = async (type: RefresherMemoType, user: string, text: string, color: string, gallery?: string) => {
    memoCache[type][user] = {
        text,
        color,
        gallery
    };

    await memoStorage[type].setValue({...memoCache[type]});
};

const checkValidType = (type: string) => MEMO_TYPES.some((key) => key === type);

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
        throw new Error(`${type} is not a valid mode. requires one of [${MEMO_TYPES.join(", ")}]`);
    }

    InternalAddToList(type, user, text, color, gallery);
};

/**
 * 메모 내용을 구합니다.
 *
 * @param type 메모 종류
 * @param user 유저
 */
export const get = (type: RefresherMemoType, user: string): RefresherMemoValue | undefined => {
    if (!checkValidType(type)) {
        throw new Error(`${type} is not a valid mode. requires one of [${MEMO_TYPES.join(", ")}]`);
    }

    return memoCache[type][user];
};

/**
 * 메모를 삭제합니다.
 *
 * @param type 메모 종류
 * @param user 유저
 */
export const remove = async (type: RefresherMemoType, user: string): Promise<void> => {
    if (!checkValidType(type)) {
        throw new Error(`${type} is not a valid mode. requires one of [${MEMO_TYPES.join(", ")}]`);
    }

    delete memoCache[type][user];
    await memoStorage[type].setValue({...memoCache[type]});
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
