import {create} from "zustand";

import {MEMO_TYPES, memoStorage} from "@/core/storage/items";
import type {MemoEntry, MemoType} from "@/core/storage/types";

interface MemosState {
    memos: Record<MemoType, Record<string, MemoEntry>>;
    setMemosRaw: (type: MemoType, memos: Record<string, MemoEntry>) => void;
    setMemo: (type: MemoType, user: string, entry: MemoEntry) => Promise<void>;
    removeMemo: (type: MemoType, user: string) => Promise<void>;
    clearType: (type: MemoType) => Promise<void>;
}

const emptyMemos = (): Record<MemoType, Record<string, MemoEntry>> => ({
    UID: {},
    NICK: {},
    IP: {}
});

let initialized = false;

/** 값 로드 + 변경 감시. 사용하는 컨텍스트에서 1회 */
export const initMemosStore = async (): Promise<void> => {
    if (initialized) return;
    initialized = true;

    await Promise.all(
        MEMO_TYPES.map(async (type) => {
            useMemosStore.getState().setMemosRaw(type, ((await memoStorage[type].getValue()) ?? {}) as Record<string, MemoEntry>);

            memoStorage[type].watch((next) => {
                if (next) useMemosStore.getState().setMemosRaw(type, next as Record<string, MemoEntry>);
            });
        })
    );
};

export const useMemosStore = create<MemosState>((set, get) => ({
    memos: emptyMemos(),

    setMemosRaw: (type, memos) => {
        set((state) => ({memos: {...state.memos, [type]: memos}}));
    },

    setMemo: async (type, user, entry) => {
        const next = {...get().memos[type], [user]: entry};
        set((state) => ({memos: {...state.memos, [type]: next}}));
        await memoStorage[type].setValue(next);
    },

    removeMemo: async (type, user) => {
        const next = {...get().memos[type]};
        delete next[user];
        set((state) => ({memos: {...state.memos, [type]: next}}));
        await memoStorage[type].setValue(next);
    },

    clearType: async (type) => {
        set((state) => ({memos: {...state.memos, [type]: {}}}));
        await memoStorage[type].setValue({});
    }
}));
