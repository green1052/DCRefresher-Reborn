import {create} from "zustand";

import {MEMO_TYPES, memoMapKey} from "@/core/storage/items";
import {typedListSync} from "@/core/storage/sync";
import type {MemoEntry, MemoType} from "@/core/storage/types";
import {markUsed, memoUsageKey} from "@/core/usage";
import {isRecord} from "@/utils/record";

type MemoMap = Record<string, MemoEntry>;

interface MemosState {
    memos: Record<MemoType, MemoMap>;
    setMemos: (type: MemoType, memos: MemoMap) => Promise<void>;
    /** 저장소의 현재 값에 change를 붙여 쓴다 (가져오기·여러 개 지우기). */
    updateMemos: (type: MemoType, change: (memos: MemoMap) => MemoMap) => Promise<void>;
    setMemo: (type: MemoType, user: string, entry: MemoEntry) => Promise<void>;
    removeMemo: (type: MemoType, user: string) => Promise<void>;
}

const isMemoEntry = (value: unknown): value is MemoEntry =>
    isRecord(value) && typeof value.text === "string" && typeof value.color === "string" && (value.gallery === undefined || typeof value.gallery === "string");

/**
 * 새 메모의 기본 색. 색상만 무작위로 고르고 채도(60%)·명도(50%)는 고정한다. 아무 RGB나 고르면 흰색·검은색에 가까운 색이 나와 한쪽 테마에서 안 보인다.
 * 색 입력칸(input[type=color])이 #rrggbb만 받으므로 HSL을 RGB로 바꾼다.
 */
export const randomColor = (): string => {
    const hue = Math.random() * 360;
    const channel = (n: number): string => {
        const k = (n + hue / 30) % 12;
        const value = 0.5 - 0.3 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(value * 255).toString(16).padStart(2, "0");
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
};

/** 저장소·가져오기 값에서 유효한 항목만 남긴다. */
export const normalizeMemoMap = (value: unknown): MemoMap =>
    isRecord(value)
        ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, MemoEntry] => isMemoEntry(entry[1])))
        : {};

/** 메모의 단일 출처. 콘텐츠·옵션 모두 이 스토어를 쓰고 저장소와 양방향 동기화된다. */
export const useMemosStore = create<MemosState>(() => ({
    memos: {UID: {}, NICK: {}, IP: {}},

    setMemos: (type, memos): Promise<void> => lists.save(type, memos),

    updateMemos: (type, change): Promise<void> => lists.update(type, change),

    setMemo: async (type, user, entry) => {
        await lists.update(type, (current) => ({...current, [user]: entry}));
    },

    removeMemo: async (type, user) => {
        await lists.update(type, (current) => {
            const {[user]: _removed, ...rest} = current;
            return rest;
        });
    }
}));

/** 그 키의 메모. 닉네임이 toString·constructor·__proto__여도 프로토타입 값을 메모로 읽지 않게 자기 속성만 본다. */
export const ownMemo = (map: MemoMap, key: string): MemoEntry | undefined => (Object.hasOwn(map, key) ? map[key] : undefined);

type MemoUser = { uid?: string; ip?: string; nick?: string };

const lookupMemo = (memos: Record<MemoType, MemoMap>, user: MemoUser, gallery?: string | null): MemoEntry | undefined => {
    // 찾은 메모는 쓰였다고 적는다 (옵션의 오래 안 쓰인 메모 거르기).
    const find = (type: MemoType, key?: string): MemoEntry | undefined => {
        const entry = key ? ownMemo(memos[type], key) : undefined;
        if (!entry || (entry.gallery && entry.gallery !== gallery)) return undefined;
        markUsed("memo", memoUsageKey(type, key!));
        return entry;
    };

    return find("UID", user.uid) ?? find("IP", user.ip) ?? find("NICK", user.nick);
};

/** 유저에 달린 메모 (아이디 > IP > 닉네임 순). 다른 갤러리 전용 메모는 건너뛴다. */
export const findMemo = (user: MemoUser, gallery?: string | null): MemoEntry | undefined =>
    lookupMemo(useMemosStore.getState().memos, user, gallery);

/** React용 findMemo. 구독한 memos로 찾아야 React Compiler가 메모가 바뀔 때 다시 계산한다. */
export const useUserMemo = (user: MemoUser, gallery?: string | null): MemoEntry | undefined =>
    lookupMemo(useMemosStore((state) => state.memos), user, gallery);

// 값이 없으면 null → 빈 목록. 같은 값이 돌아오면 구독자(배지 전체 다시 그리기)를 깨우지 않는다 (typedListSync).
const lists = typedListSync({
    types: MEMO_TYPES,
    keyOf: memoMapKey,
    normalize: normalizeMemoMap,
    get: (): Record<MemoType, MemoMap> => useMemosStore.getState().memos,
    set: (memos) => useMemosStore.setState({memos}),
    failure: "메모를 저장하지 못했습니다.",
    lock: "refresher:memos"
});

/** 저장소 값을 읽고 변경(다른 탭·옵션 페이지)을 감시한다. 여러 번 불러도 한 번만 한다. signal은 콘텐츠 스크립트 컨텍스트의 것이다. */
export const initMemosStore = lists.start;
