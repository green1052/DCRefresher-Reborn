import {create} from "zustand";

import {MEMO_TYPES, memoStorage} from "@/core/storage/items";
import type {MemoEntry, MemoType} from "@/core/storage/types";
import {once} from "@/utils/once";
import {isRecord} from "@/utils/record";

type MemoMap = Record<string, MemoEntry>;

interface MemosState {
    memos: Record<MemoType, MemoMap>;
    setMemos: (type: MemoType, memos: MemoMap) => Promise<void>;
    setMemo: (type: MemoType, user: string, entry: MemoEntry) => Promise<void>;
    removeMemo: (type: MemoType, user: string) => Promise<void>;
    clearType: (type: MemoType) => Promise<void>;
}

const isMemoEntry = (value: unknown): value is MemoEntry =>
    isRecord(value) && typeof value.text === "string" && typeof value.color === "string" && (value.gallery === undefined || typeof value.gallery === "string");

/** 새 메모의 기본 색 */
export const randomColor = (): string => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;

/** 저장소·가져오기 값에서 유효한 항목만 남긴다 */
export const normalizeMemoMap = (value: unknown): MemoMap =>
    isRecord(value)
        ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, MemoEntry] => isMemoEntry(entry[1])))
        : {};

/** 메모의 단일 출처. 콘텐츠·옵션 모두 이 스토어를 쓰고 저장소와 양방향 동기화된다 */
export const useMemosStore = create<MemosState>((set, get) => ({
    memos: {UID: {}, NICK: {}, IP: {}},

    setMemos: async (type, memos) => {
        set((state) => ({memos: {...state.memos, [type]: memos}}));
        try {
            await memoStorage[type].setValue(memos);
        } catch (e) {
            // 저장되지 않은 메모가 보이지 않게 저장소 값으로 되돌린다. 알림은 부른 쪽에 맡긴다
            console.error("메모를 저장하지 못했습니다.", e);
            await load().catch(console.error);
            throw e;
        }
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

type MemoUser = { uid?: string; ip?: string; nick?: string };

const lookupMemo = (memos: Record<MemoType, MemoMap>, user: MemoUser, gallery?: string | null): MemoEntry | undefined => {
    // 닉네임이 toString·constructor·__proto__여도 프로토타입 값을 메모로 읽지 않게 자기 속성만 본다
    const find = (map: MemoMap, key?: string): MemoEntry | undefined => {
        const entry = key && Object.hasOwn(map, key) ? map[key] : undefined;
        return entry && (!entry.gallery || entry.gallery === gallery) ? entry : undefined;
    };

    return find(memos.UID, user.uid) ?? find(memos.IP, user.ip) ?? find(memos.NICK, user.nick);
};

/** 유저에 달린 메모 (아이디 > IP > 닉네임 순). 다른 갤러리 전용 메모는 건너뛴다 */
export const findMemo = (user: MemoUser, gallery?: string | null): MemoEntry | undefined =>
    lookupMemo(useMemosStore.getState().memos, user, gallery);

/** React용 findMemo. 구독한 memos로 찾아야 React Compiler가 메모가 바뀔 때 다시 계산한다 */
export const useUserMemo = (user: MemoUser, gallery?: string | null): MemoEntry | undefined =>
    lookupMemo(useMemosStore((state) => state.memos), user, gallery);

// 이 탭의 쓰기도 watch로 돌아온다. 값이 같으면 state를 그대로 돌려줘 구독자(배지 전체 다시 그리기)를 깨우지 않는다
const setMap = (type: MemoType, value: unknown): void =>
    useMemosStore.setState((state) => {
        const next = normalizeMemoMap(value);
        return JSON.stringify(state.memos[type]) === JSON.stringify(next) ? state : {memos: {...state.memos, [type]: next}};
    });

const load = async (): Promise<void> => {
    const maps = await Promise.all(MEMO_TYPES.map((type) => memoStorage[type].getValue()));
    for (const [index, type] of MEMO_TYPES.entries()) setMap(type, maps[index]);
};

/** 저장소 값을 읽고 변경(다른 탭·옵션 페이지)을 감시한다. 여러 번 불러도 한 번만 한다 */
export const initMemosStore = once(async () => {
    // 다 읽은 뒤에 감시를 건다. 읽기가 실패하면 once가 다음 호출에 다시 시도하는데, 그때 감시가 두 번 걸리지 않는다
    await load();
    for (const type of MEMO_TYPES) memoStorage[type].watch((next) => setMap(type, next));

    // bfcache에서 돌아온 탭은 그사이의 변경을 받지 못했다. 옛 메모로 쓰면 다른 탭의 변경을 덮으므로 다시 읽는다
    window.addEventListener("pageshow", (ev) => {
        if (ev.persisted) void load().catch(console.error);
    });
});
