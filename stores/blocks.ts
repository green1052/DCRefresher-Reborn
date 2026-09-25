import {create} from "zustand";

import {BLOCK_TYPES, blockDefaultsStorage, blockStorage, DEFAULT_DETECT_MODE, DETECT_MODES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";

export type BlockInputFields = Omit<BlockEntry, "id">;

interface BlocksState {
    entries: Record<BlockType, BlockEntry[]>;
    defaults: Record<BlockType, DetectMode>;
    setEntries: (type: BlockType, entries: BlockEntry[]) => Promise<void>;
    addEntry: (type: BlockType, fields: BlockInputFields) => Promise<void>;
    updateEntry: (type: BlockType, id: string, fields: BlockInputFields) => Promise<void>;
    removeEntry: (type: BlockType, id: string) => Promise<void>;
    clearType: (type: BlockType) => Promise<void>;
    setDefault: (type: BlockType, mode: DetectMode) => Promise<void>;
}

const isBlockEntry = (value: unknown): value is Omit<BlockEntry, "id"> & { id?: unknown } => {
    if (!value || typeof value !== "object") return false;

    const entry = value as Partial<BlockEntry>;
    return (
        typeof entry.content === "string" &&
        typeof entry.isRegex === "boolean" &&
        (entry.gallery === undefined || typeof entry.gallery === "string") &&
        (entry.extra === undefined || typeof entry.extra === "string") &&
        (entry.mode === undefined || DETECT_MODES.includes(entry.mode))
    );
};

/** 저장소/가져오기 값 → 유효 항목만, id 없으면 부여 */
export const normalizeBlockList = (value: unknown): BlockEntry[] =>
    Array.isArray(value)
        ? value.filter(isBlockEntry).map((entry) => ({...entry, id: typeof entry.id === "string" ? entry.id : crypto.randomUUID()}))
        : [];

const emptyEntries = (): Record<BlockType, BlockEntry[]> =>
    Object.fromEntries(BLOCK_TYPES.map((type) => [type, []])) as unknown as Record<BlockType, BlockEntry[]>;

/** 같은 content+gallery는 교체 */
const dedupe = (list: BlockEntry[], content: string, gallery: string | undefined, keepId?: string): BlockEntry[] =>
    list.filter((entry) => entry.id === keepId || !(entry.content === content && (entry.gallery ?? "") === (gallery ?? "")));

/** 차단 목록/기본 모드의 단일 출처. 콘텐츠·옵션 모두 이 스토어를 쓰고 저장소와 양방향 동기화된다 */
export const useBlocksStore = create<BlocksState>((set, get) => ({
    entries: emptyEntries(),
    defaults: {...DEFAULT_DETECT_MODE},

    setEntries: async (type, entries) => {
        set((state) => ({entries: {...state.entries, [type]: entries}}));
        await blockStorage[type].setValue(entries);
    },

    addEntry: async (type, fields) => {
        const list = dedupe(get().entries[type], fields.content, fields.gallery);
        await get().setEntries(type, [...list, {id: crypto.randomUUID(), ...fields}]);
    },

    updateEntry: async (type, id, fields) => {
        const list = dedupe(get().entries[type], fields.content, fields.gallery, id);
        await get().setEntries(type, list.map((entry) => (entry.id === id ? {...entry, ...fields, id} : entry)));
    },

    removeEntry: async (type, id) => {
        await get().setEntries(type, get().entries[type].filter((entry) => entry.id !== id));
    },

    clearType: async (type) => {
        await get().setEntries(type, []);
    },

    setDefault: async (type, mode) => {
        set((state) => ({defaults: {...state.defaults, [type]: mode}}));
        await blockDefaultsStorage.setValue(get().defaults);
    }
}));

let initialized: Promise<void> | null = null;

/** 저장소 값 로드 + 변경 감시 (다른 탭/옵션 페이지에서 바뀐 값 반영). 여러 번 불러도 1회 */
export const initBlocksStore = (): Promise<void> =>
    (initialized ??= (async () => {
        const unwatch: (() => void)[] = [];

        try {
            // 이 탭의 쓰기도 watch로 돌아온다 — 값이 같으면 state를 그대로 돌려줘 구독자를 다시 렌더시키지 않는다
            const setList = (type: BlockType, value: unknown): void =>
                useBlocksStore.setState((state) => {
                    const next = normalizeBlockList(value);
                    return JSON.stringify(state.entries[type]) === JSON.stringify(next) ? state : {entries: {...state.entries, [type]: next}};
                });

            await Promise.all(
                BLOCK_TYPES.map(async (type) => {
                    setList(type, await blockStorage[type].getValue());
                    unwatch.push(blockStorage[type].watch((next) => setList(type, next)));
                })
            );

            const setDefaults = (next: Partial<Record<BlockType, DetectMode>> | null): void =>
                useBlocksStore.setState({defaults: {...DEFAULT_DETECT_MODE, ...next}});

            setDefaults(await blockDefaultsStorage.getValue());
            unwatch.push(blockDefaultsStorage.watch(setDefaults));
        } catch (e) {
            // 실패를 붙들고 있으면 다음 호출도 계속 실패한다 — 비워 두어 다시 시도하게 (먼저 건 감시는 풀어 두 번 걸리지 않게)
            for (const off of unwatch) off();
            initialized = null;
            throw e;
        }
    })());
