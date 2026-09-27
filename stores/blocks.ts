import {create} from "zustand";
import {arrayIncludes} from "ts-extras";

import {BLOCK_TYPES, blockDefaultsStorage, blockStorage, DEFAULT_DETECT_MODE, DETECT_MODE_NAMES, DETECT_MODES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {once} from "@/utils/once";
import {isRecord} from "@/utils/record";

export type BlockInputFields = Omit<BlockEntry, "id">;

interface BlocksState {
    entries: Record<BlockType, BlockEntry[]>;
    defaults: Record<BlockType, DetectMode>;
    setEntries: (type: BlockType, entries: BlockEntry[]) => Promise<void>;
    addEntry: (type: BlockType, fields: BlockInputFields) => Promise<void>;
    /** 여러 항목을 한 번의 쓰기로 */
    addEntries: (type: BlockType, list: BlockInputFields[]) => Promise<void>;
    updateEntry: (type: BlockType, id: string, fields: BlockInputFields) => Promise<void>;
    removeEntry: (type: BlockType, id: string) => Promise<void>;
    clearType: (type: BlockType) => Promise<void>;
    setDefault: (type: BlockType, mode: DetectMode) => Promise<void>;
}

const isBlockEntry = (value: unknown): value is Omit<BlockEntry, "id"> & { id?: unknown } =>
    isRecord(value) &&
    typeof value.content === "string" &&
    typeof value.isRegex === "boolean" &&
    (value.gallery === undefined || typeof value.gallery === "string") &&
    (value.extra === undefined || typeof value.extra === "string") &&
    (value.mode === undefined || arrayIncludes(DETECT_MODES, value.mode));

/** 항목의 플래그 표시 ([정규식] [갤러리: X] [모드명] 순). extra(별명)와 따로 필드에서 만든다 */
export const composeExtra = (fields: { isRegex: boolean; gallery?: string; mode?: DetectMode }): string =>
    [
        fields.isRegex ? "[정규식]" : "",
        fields.gallery ? `[갤러리: ${fields.gallery}]` : "",
        fields.mode ? `[${DETECT_MODE_NAMES[fields.mode]}]` : ""
    ]
        .filter(Boolean)
        .join(" ");

/** 저장소·가져오기 값에서 유효한 항목만 남긴다. id가 없거나 겹치면 새로 준다 (겹친 id는 삭제·수정이 그 항목 모두에 걸린다) */
export const normalizeBlockList = (value: unknown): BlockEntry[] => {
    if (!Array.isArray(value)) return [];

    const ids = new Set<string>();
    return value.filter(isBlockEntry).map((entry) => {
        const id = typeof entry.id === "string" && !ids.has(entry.id) ? entry.id : crypto.randomUUID();
        ids.add(id);
        // 예전 항목(v5, 이전 다이얼로그)은 플래그 문자열을 extra에 넣었다. 표시할 때 필드에서 만드니 버린다.
        // 키를 지우지 않고 undefined로 덮어 키 순서를 지킨다. 저장한 값과 JSON이 달라지면 이 탭의 쓰기가 watch로 돌아올 때마다 구독자가 다시 돈다
        return entry.extra && entry.extra === composeExtra(entry) ? {...entry, id, extra: undefined} : {...entry, id};
    });
};

const emptyEntries = (): Record<BlockType, BlockEntry[]> => Object.fromEntries(BLOCK_TYPES.map((type) => [type, []])) as unknown as Record<BlockType, BlockEntry[]>;

/** 같은 content+gallery는 한 항목이다 */
export const blockKey = ({content, gallery}: BlockInputFields): string => JSON.stringify([content, gallery ?? ""]);

/** 차단 목록/기본 모드의 단일 출처. 콘텐츠·옵션 모두 이 스토어를 쓰고 저장소와 양방향 동기화된다 */
export const useBlocksStore = create<BlocksState>((set, get) => ({
    entries: emptyEntries(),
    defaults: {...DEFAULT_DETECT_MODE},

    setEntries: async (type, entries) => {
        set((state) => ({entries: {...state.entries, [type]: entries}}));
        await persist(blockStorage[type].setValue(entries));
    },

    addEntry: (type, fields) => get().addEntries(type, [fields]),

    addEntries: async (type, list) => {
        // 같은 content+gallery는 새로 들어온 쪽으로 바꿔 맨 뒤로 보낸다. id는 가져온 id가 기존 항목과 겹치지 않게 늘 새로 준다
        const added = new Map(list.map((fields) => [blockKey(fields), {...fields, id: crypto.randomUUID()}]));
        await get().setEntries(type, [...get().entries[type].filter((entry) => !added.has(blockKey(entry))), ...added.values()]);
    },

    updateEntry: async (type, id, fields) => {
        const list = get().entries[type];
        // 다른 탭에서 지웠거나 가져오기로 id가 바뀐 항목이면 새로 넣는다. 아래 수정으로 넘기면 같은 content 항목만 지워지고 수정은 사라진다
        if (!list.some((entry) => entry.id === id)) return get().addEntries(type, [fields]);

        const key = blockKey(fields);
        await get().setEntries(
            type,
            list.filter((entry) => entry.id === id || blockKey(entry) !== key).map((entry) => (entry.id === id ? {...entry, ...fields, id} : entry))
        );
    },

    removeEntry: async (type, id) => {
        await get().setEntries(type, get().entries[type].filter((entry) => entry.id !== id));
    },

    clearType: async (type) => {
        await get().setEntries(type, []);
    },

    setDefault: async (type, mode) => {
        set((state) => ({defaults: {...state.defaults, [type]: mode}}));
        await persist(blockDefaultsStorage.setValue(get().defaults));
    }
}));

// 이 탭의 쓰기도 watch로 돌아온다. 값이 같으면 state를 그대로 돌려줘 구독자를 다시 렌더시키지 않는다
const setList = (type: BlockType, value: unknown): void =>
    useBlocksStore.setState((state) => {
        const next = normalizeBlockList(value);
        return JSON.stringify(state.entries[type]) === JSON.stringify(next) ? state : {entries: {...state.entries, [type]: next}};
    });

// 가져오기·복원 값은 검증 없이 들어온다. 모르는 유형·모드(소문자 등)는 버리고 그 유형은 기본 모드로 둔다
const setDefaults = (next: Partial<Record<BlockType, DetectMode>>): void =>
    useBlocksStore.setState({
        defaults: {
            ...DEFAULT_DETECT_MODE,
            ...Object.fromEntries(Object.entries(next).filter(([type, mode]) => arrayIncludes(BLOCK_TYPES, type) && arrayIncludes(DETECT_MODES, mode)))
        }
    });

const load = async (): Promise<void> => {
    const [lists, defaults] = await Promise.all([
        Promise.all(BLOCK_TYPES.map((type) => blockStorage[type].getValue())),
        blockDefaultsStorage.getValue()
    ]);
    for (const [index, type] of BLOCK_TYPES.entries()) setList(type, lists[index]);
    setDefaults(defaults);
};

/** 화면에 먼저 반영한 값을 저장한다. 저장이 실패하면 저장소 값으로 되돌려 저장된 것처럼 보이지 않게 하고, 알림은 부른 쪽에 맡긴다 */
const persist = async (write: Promise<void>): Promise<void> => {
    try {
        await write;
    } catch (e) {
        console.error("차단 목록을 저장하지 못했습니다.", e);
        await load().catch(console.error);
        throw e;
    }
};

/** 저장소 값을 읽고 변경(다른 탭·옵션 페이지)을 감시한다. 여러 번 불러도 한 번만 한다 */
export const initBlocksStore = once(async () => {
    // 다 읽은 뒤에 감시를 건다. 읽기가 실패하면 once가 다음 호출에 다시 시도하는데, 그때 감시가 두 번 걸리지 않는다
    await load();
    for (const type of BLOCK_TYPES) blockStorage[type].watch((next) => setList(type, next));
    blockDefaultsStorage.watch(setDefaults);

    // bfcache에서 돌아온 탭은 그사이의 변경을 받지 못했다. 옛 목록으로 쓰면 다른 탭의 변경을 덮으므로 다시 읽는다
    window.addEventListener("pageshow", (ev) => {
        if (ev.persisted) void load().catch(console.error);
    });
});
