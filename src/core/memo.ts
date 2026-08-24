import {MEMO_TYPES, memoStorage} from "@/storage/wxtStorage";
import {onMessage} from "@/http/messaging";
import eventBus from "./eventbus";

export const TYPE_NAMES = {
    UID: "유저 ID",
    NICK: "닉네임",
    IP: "IP"
};

type MemoCache = Record<RefresherMemoType, Record<string, RefresherMemoValue>>;

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

export const normalizeMemoMap = (value: unknown): Record<string, RefresherMemoValue> => {
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

// 메모 스토리지의 초기 로드 + 변경 감시를 등록한다.
// 콘텐츠 스크립트(core/memo.ts)와 팝업(useMemos)이 같은 로직을 공유한다.
// 반환값: 감시 해제 함수 (팝업 등 이중 등록 방지용 클린업).
export const watchMemoStorages = (
    onMemo: (type: RefresherMemoType, memos: Record<string, RefresherMemoValue>) => void
): (() => void) => {
    const unwatchers: (() => void)[] = [];

    for (const type of MEMO_TYPES) {
        void memoStorage[type].getValue().then((value) => onMemo(type, normalizeMemoMap(value)));
        unwatchers.push(memoStorage[type].watch((value) => onMemo(type, normalizeMemoMap(value))));
    }

    return () => {
        for (const unwatch of unwatchers) unwatch();
    };
};

watchMemoStorages((type, memos) => {
    memoCache[type] = memos;
});

const internalAddToList = async (type: RefresherMemoType, user: string, text: string, color: string, gallery?: string) => {
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
export const add = async (type: RefresherMemoType, user: string, text: string, color: string, gallery?: string): Promise<void> => {
    if (!checkValidType(type)) {
        throw new Error(`${type} is not a valid type. requires one of [${MEMO_TYPES.join(", ")}]`);
    }

    await internalAddToList(type, user, text, color, gallery);
};

/**
 * 메모 내용을 구합니다.
 *
 * @param type 메모 종류
 * @param user 유저
 */
// 타입은 컴파일 타임에 보장되므로 런타임 검증 생략 (핫 패스)
export const get = (type: RefresherMemoType, user: string): RefresherMemoValue | undefined => {
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
        throw new Error(`${type} is not a valid type. requires one of [${MEMO_TYPES.join(", ")}]`);
    }

    delete memoCache[type][user];
    await memoStorage[type].setValue({...memoCache[type]});
};

onMessage("memoSelected", () => {
    eventBus.emit("refresherUpdateUserMemo");
});

export default {
    TYPE_NAMES,
    add,
    get,
    remove
};
