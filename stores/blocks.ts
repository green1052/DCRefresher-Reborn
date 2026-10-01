import {create} from "zustand";
import {arrayIncludes} from "ts-extras";

import {BLOCK_DEFAULTS_KEY, BLOCK_TYPES, blockDefaultsStorage, blockListKey, blockStorage, DEFAULT_DETECT_MODE, DETECT_MODE_NAMES, DETECT_MODES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {storageSync} from "@/core/storage/sync";
import {saveOrReload} from "@/utils/error";
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

/** 유형마다 빈 차단 목록. 유형을 늘리면 여기서 타입 오류가 난다 */
export const emptyEntries = (): Record<BlockType, BlockEntry[]> => ({COMMENT: [], DCCON: [], ID: [], IP: [], NICK: [], TAB: [], TEXT: [], TITLE: []});

/** 같은 content+gallery는 한 항목이다 */
export const blockKey = ({content, gallery}: BlockInputFields): string => JSON.stringify([content, gallery ?? ""]);

/** 차단 목록/기본 모드의 단일 출처. 콘텐츠·옵션 모두 이 스토어를 쓰고 저장소와 양방향 동기화된다 */
export const useBlocksStore = create<BlocksState>((set, get) => ({
    entries: emptyEntries(),
    defaults: {...DEFAULT_DETECT_MODE},

    setEntries: async (type, entries) => {
        set((state) => ({entries: {...state.entries, [type]: entries}}));
        await saveOrReload(blockStorage[type].setValue(entries), load, "차단 목록을 저장하지 못했습니다.");
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

    setDefault: async (type, mode) => {
        set((state) => ({defaults: {...state.defaults, [type]: mode}}));
        await saveOrReload(blockDefaultsStorage().setValue(get().defaults), load, "차단 목록을 저장하지 못했습니다.");
    }
}));

// 이 탭의 쓰기도 watch로 돌아온다. 값이 같으면 state를 그대로 돌려줘 구독자를 다시 렌더시키지 않는다
const setList = (type: BlockType, value: unknown): void =>
    useBlocksStore.setState((state) => {
        const next = normalizeBlockList(value);
        return JSON.stringify(state.entries[type]) === JSON.stringify(next) ? state : {entries: {...state.entries, [type]: next}};
    });

/** 저장소·백업의 기본 차단 모드. 가져오기·복원 값은 검증 없이 들어오므로 모르는 모드(소문자 등)는 버리고 그 유형은 기본 모드로 둔다 */
export const normalizeDefaults = (value: unknown): Record<BlockType, DetectMode> => {
    const defaults = {...DEFAULT_DETECT_MODE};
    if (!isRecord(value)) return defaults;
    for (const type of BLOCK_TYPES) {
        const mode = value[type];
        if (arrayIncludes(DETECT_MODES, mode)) defaults[type] = mode;
    }
    return defaults;
};

const setDefaults = (next: unknown): void => useBlocksStore.setState({defaults: normalizeDefaults(next)});

const listTypes = new Map<string, BlockType>(BLOCK_TYPES.map((type) => [blockListKey(type), type]));

// 값이 없으면 null이고, setList·setDefaults가 기본값으로 맞춘다
const sync = storageSync([BLOCK_DEFAULTS_KEY, ...BLOCK_TYPES.map(blockListKey)], (key, value) => {
    const type = listTypes.get(key);
    if (type) setList(type, value);
    else setDefaults(value);
});
const load = sync.load;

/** 저장소 값을 읽고 변경(다른 탭·옵션 페이지)을 감시한다. 여러 번 불러도 한 번만 한다. signal은 콘텐츠 스크립트 컨텍스트의 것이다 */
export const initBlocksStore = sync.start;
