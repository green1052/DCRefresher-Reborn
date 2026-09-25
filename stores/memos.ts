import {create} from "zustand";

import {MEMO_TYPES, memoStorage} from "@/core/storage/items";
import type {MemoEntry, MemoType} from "@/core/storage/types";

type MemoMap = Record<string, MemoEntry>;

interface MemosState {
    memos: Record<MemoType, MemoMap>;
    setMemos: (type: MemoType, memos: MemoMap) => Promise<void>;
    setMemo: (type: MemoType, user: string, entry: MemoEntry) => Promise<void>;
    removeMemo: (type: MemoType, user: string) => Promise<void>;
    clearType: (type: MemoType) => Promise<void>;
}

const isMemoEntry = (value: unknown): value is MemoEntry => {
    if (!value || typeof value !== "object") return false;

    const memo = value as Partial<MemoEntry>;
    return typeof memo.text === "string" && typeof memo.color === "string" && (memo.gallery === undefined || typeof memo.gallery === "string");
};

/** 저장소/가져오기 값 → 유효 항목만 */
export const normalizeMemoMap = (value: unknown): MemoMap =>
    value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).filter(([, memo]) => isMemoEntry(memo)))
        : {};

/** 메모의 단일 출처. 콘텐츠·옵션 모두 이 스토어를 쓰고 저장소와 양방향 동기화된다 */
export const useMemosStore = create<MemosState>((set, get) => ({
    memos: {UID: {}, NICK: {}, IP: {}},

    setMemos: async (type, memos) => {
        set((state) => ({memos: {...state.memos, [type]: memos}}));
        await memoStorage[type].setValue(memos);
    },

    setMemo: async (type, user, entry) => {
        await get().setMemos(type, {...get().memos[type], [user]: entry});
    },

    removeMemo: async (type, user) => {
        const {[user]: _removed, ...rest} = get().memos[type];
        await get().setMemos(type, rest);
    },

    clearType: async (type) => {
        await get().setMemos(type, {});
    }
}));

/** 유저에 달린 메모 (아이디 > IP > 닉네임 순). 다른 갤러리 전용 메모는 건너뛴다 */
export const findMemo = (user: { uid?: string; ip?: string; nick?: string }, gallery?: string | null): MemoEntry | undefined => {
    const {memos} = useMemosStore.getState();
    const visible = (entry: MemoEntry | undefined): MemoEntry | undefined => (entry && (!entry.gallery || entry.gallery === gallery) ? entry : undefined);

    return (
        (user.uid ? visible(memos.UID[user.uid]) : undefined) ??
        (user.ip ? visible(memos.IP[user.ip]) : undefined) ??
        (user.nick ? visible(memos.NICK[user.nick]) : undefined)
    );
};

let initialized: Promise<void> | null = null;

/** 저장소 값 로드 + 변경 감시 (다른 탭/옵션 페이지에서 바뀐 값 반영). 여러 번 불러도 1회 */
export const initMemosStore = (): Promise<void> =>
    (initialized ??= (async () => {
        // 이 탭의 쓰기도 watch로 돌아온다 — 값이 같으면 state를 그대로 돌려줘 구독자(배지 전체 다시 그리기)를 깨우지 않는다
        const setMap = (type: MemoType, value: unknown): void =>
            useMemosStore.setState((state) => {
                const next = normalizeMemoMap(value);
                return JSON.stringify(state.memos[type]) === JSON.stringify(next) ? state : {memos: {...state.memos, [type]: next}};
            });

        await Promise.all(
            MEMO_TYPES.map(async (type) => {
                setMap(type, await memoStorage[type].getValue());
                memoStorage[type].watch((next) => setMap(type, next));
            })
        );
    })());
