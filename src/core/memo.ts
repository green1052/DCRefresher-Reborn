import * as communicate from "./communicate";
import { eventBus } from "./eventbus";
import storage from "../utils/storage";
import browser from "webextension-polyfill";

const MEMO_NAMESPACE = "__REFRESHER_MEMO";

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

function SendToBackground() {
    browser.runtime.sendMessage(
        JSON.stringify({
            memos_store: MEMO_CACHE
        })
    );
}

let MEMO_CACHE: MemoCache = {
    UID: {},
    NICK: {},
    IP: {}
};

MEMO_TYPES_KEYS.forEach(async (key) => {
    const memo = await storage.get<Record<string, RefresherMemoValue>>(`${MEMO_NAMESPACE}:${key}`);

    MEMO_CACHE[key] = memo ?? {};

    SendToBackground();
});

const InternalAddToList = (
    type: RefresherMemoType,
    user: string,
    text: string,
    color: string,
    gallery?: string
) => {
    MEMO_CACHE[type][user] = {
        text,
        color,
        gallery
    };

    storage.set(`${MEMO_NAMESPACE}:${type}`, MEMO_CACHE[type]);
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
export const add = (
    type: RefresherMemoType,
    user: string,
    text: string,
    color: string,
    gallery?: string
): void => {
    if (!checkValidType(type)) {
        throw `${type} is not a valid mode. requires one of [${MEMO_TYPES_KEYS.join(", ")}]`;
    }

    InternalAddToList(type, user, text, color, gallery);
    SendToBackground();
};

/**
 * 메모 내용을 구합니다.
 *
 * @param type 메모 종류
 * @param user 유저
 */
export const get = (type: RefresherMemoType, user: string): RefresherMemoValue => {
    if (!checkValidType(type)) {
        throw `${type} is not a valid mode. requires one of [${MEMO_TYPES_KEYS.join(", ")}]`;
    }

    return MEMO_CACHE[type][user];
};

/**
 * 메모를 삭제합니다.
 *
 * @param type 메모 종류
 * @param user 유저
 */
export const remove = (type: RefresherMemoType, user: string): void => {
    if (!checkValidType(type)) {
        throw `${type} is not a valid mode. requires one of [${MEMO_TYPES_KEYS.join(", ")}]`;
    }

    delete MEMO_CACHE[type][user];
    storage.set(`${MEMO_NAMESPACE}:${type}`, MEMO_CACHE[type]);
    SendToBackground();
};

communicate.addHook("memoSelected", () => {
    eventBus.emit("refresherUpdateUserMemo");
});

communicate.addHook("updateMemos", ({ memos }) => {
    MEMO_CACHE = memos;
});
