import {create} from "zustand";

import {isBlockEntry} from "@/core/block";
import {BLOCK_TYPES, blockDefaultsStorage, blockStorage, DEFAULT_DETECT_MODE} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";

export interface BlockInputFields {
    content: string;
    isRegex: boolean;
    mode?: DetectMode;
    gallery?: string;
    extra?: string;
}

interface BlocksState {
    entries: Record<BlockType, BlockEntry[]>;
    defaults: Record<BlockType, DetectMode>;
    setEntriesRaw: (type: BlockType, entries: BlockEntry[]) => void;
    setEntries: (type: BlockType, entries: BlockEntry[]) => Promise<void>;
    addEntry: (type: BlockType, fields: BlockInputFields) => Promise<void>;
    updateEntry: (type: BlockType, id: string, fields: BlockInputFields) => Promise<void>;
    removeEntry: (type: BlockType, id: string) => Promise<void>;
    clearType: (type: BlockType) => Promise<void>;
    setDefault: (type: BlockType, mode: DetectMode) => Promise<void>;
}

const emptyEntries = (): Record<BlockType, BlockEntry[]> => ({
    NICK: [],
    ID: [],
    IP: [],
    TITLE: [],
    TEXT: [],
    COMMENT: [],
    DCCON: [],
    TAB: []
});

/** 같은 content+gallery는 교체 */
const dedupe = (list: BlockEntry[], content: string, gallery: string | undefined, keepId?: string): BlockEntry[] =>
    list.filter((entry) => entry.id === keepId || !(entry.content === content && (entry.gallery ?? "") === (gallery ?? "")));

let initialized = false;

/** 값 로드 + 변경 감시. 사용하는 컨텍스트에서 1회 */
export const initBlocksStore = async (): Promise<void> => {
    if (initialized) return;
    initialized = true;

    const store = useBlocksStore.getState();

    await Promise.all(
        BLOCK_TYPES.map(async (type) => {
            store.setEntriesRaw(type, ((await blockStorage[type].getValue()) ?? []).filter(isBlockEntry));
            blockStorage[type].watch((next) => {
                if (next) useBlocksStore.getState().setEntriesRaw(type, next.filter(isBlockEntry));
            });
        })
    );

    const storedDefaults = await blockDefaultsStorage.getValue();
    if (storedDefaults) useBlocksStore.setState({defaults: storedDefaults});

    blockDefaultsStorage.watch((next) => {
        if (next) useBlocksStore.setState({defaults: next});
    });
};

export const useBlocksStore = create<BlocksState>((set, get) => ({
    entries: emptyEntries(),
    defaults: {...DEFAULT_DETECT_MODE},

    setEntriesRaw: (type, entries) => {
        set((state) => ({entries: {...state.entries, [type]: entries}}));
    },

    setEntries: async (type, entries) => {
        set((state) => ({entries: {...state.entries, [type]: entries}}));
        await blockStorage[type].setValue(entries);
    },

    addEntry: async (type, fields) => {
        const list = dedupe(get().entries[type], fields.content, fields.gallery);
        const entry: BlockEntry = {id: crypto.randomUUID(), ...fields};

        await get().setEntries(type, [...list, entry]);
    },

    updateEntry: async (type, id, fields) => {
        const list = dedupe(get().entries[type], fields.content, fields.gallery, id);
        const index = list.findIndex((entry) => entry.id === id);
        if (index === -1) return;

        list[index] = {...list[index], ...fields, id};
        await get().setEntries(type, [...list]);
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
