import {create} from "zustand";
import {shallow} from "zustand/shallow";

import {BLOCK_DEFAULTS_KEY, BLOCK_TYPES, blockDefaultsStorage, blockListKey, DEFAULT_DETECT_MODE, DETECT_MODE_NAMES, DETECT_MODES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {typedListSync} from "@/core/storage/sync";
import {saveOrReload} from "@/utils/error";
import {isRecord} from "@/utils/record";
import {arrayIncludes} from "@/utils/typed";

export type BlockInputFields = Omit<BlockEntry, "id">;

interface BlocksState {
    entries: Record<BlockType, BlockEntry[]>;
    defaults: Record<BlockType, DetectMode>;
    setEntries: (type: BlockType, entries: BlockEntry[]) => Promise<void>;
    /** 저장소의 현재 값에 change를 붙여 쓴다 (가져오기·여러 개 지우기). */
    updateEntries: (type: BlockType, change: (entries: BlockEntry[]) => BlockEntry[]) => Promise<void>;
    addEntry: (type: BlockType, fields: BlockInputFields) => Promise<void>;
    /** 여러 항목을 한 번의 쓰기로. */
    addEntries: (type: BlockType, list: BlockInputFields[]) => Promise<void>;
    updateEntry: (type: BlockType, id: string, fields: BlockInputFields) => Promise<void>;
    removeEntry: (type: BlockType, id: string) => Promise<void>;
    setDefault: (type: BlockType, mode: DetectMode) => Promise<void>;
}

const isBlockEntry = (value: unknown): value is Omit<BlockEntry, "id"> & { id?: unknown } =>
    isRecord(value) &&
    // 빈 내용은 포함 검사에서 모든 글에 맞는다. 다이얼로그는 막지만 가져오기·옛 데이터로 들어올 수 있다.
    typeof value.content === "string" &&
    value.content.trim() !== "" &&
    typeof value.isRegex === "boolean" &&
    (value.gallery === undefined || typeof value.gallery === "string") &&
    (value.extra === undefined || typeof value.extra === "string") &&
    (value.mode === undefined || arrayIncludes(DETECT_MODES, value.mode));

/** 항목의 플래그 표시 ([정규식] [갤러리: X] [모드명] 순). extra(별명)와 따로 필드에서 만든다. */
export const composeExtra = (fields: { isRegex: boolean; gallery?: string; mode?: DetectMode }): string =>
    [
        fields.isRegex ? "[정규식]" : "",
        fields.gallery ? `[갤러리: ${fields.gallery}]` : "",
        fields.mode ? `[${DETECT_MODE_NAMES[fields.mode]}]` : ""
    ]
        .filter(Boolean)
        .join(" ");

/**
 * 저장소·가져오기 값에서 유효한 항목만 남긴다. id가 없거나 겹치면 새로 준다 (겹친 id는 삭제·수정이 그 항목 모두에 걸린다).
 * known: id 없는 항목(백업·내보내기는 id를 뺀다)이 같은 content+gallery 항목의 id를 이어받을 목록. 새 id면 그 항목의 사용 기록(core/usage.ts)이 사라진다.
 */
export const normalizeBlockList = (value: unknown, known: BlockEntry[] = []): BlockEntry[] => {
    if (!Array.isArray(value)) return [];

    const knownIds = new Map(known.map((entry) => [blockKey(entry), entry.id]));
    const ids = new Set<string>();
    return value.filter(isBlockEntry).map((entry) => {
        const given = typeof entry.id === "string" ? entry.id : knownIds.get(blockKey(entry));
        const id = given !== undefined && !ids.has(given) ? given : crypto.randomUUID();
        ids.add(id);
        // 예전 항목(v5, 이전 다이얼로그)은 플래그 문자열을 extra에 넣었다. 표시할 때 필드에서 만드니 버린다.
        // 키를 지우지 않고 undefined로 덮어 키 순서를 지킨다. 저장한 값과 JSON이 달라지면 이 탭의 쓰기가 watch로 돌아올 때마다 구독자가 다시 돈다.
        return entry.extra && entry.extra === composeExtra(entry) ? {...entry, id, extra: undefined} : {...entry, id};
    });
};

/** 유형마다 빈 차단 목록. 유형을 늘리면 여기서 타입 오류가 난다. */
export const emptyEntries = (): Record<BlockType, BlockEntry[]> => ({COMMENT: [], DCCON: [], ID: [], IP: [], NICK: [], TAB: [], TEXT: [], TITLE: []});

/** 같은 content+gallery는 한 항목이다. */
export const blockKey = ({content, gallery}: BlockInputFields): string => JSON.stringify([content, gallery ?? ""]);

/** 차단 목록/기본 모드의 단일 출처. 콘텐츠·옵션 모두 이 스토어를 쓰고 저장소와 양방향 동기화된다. */
export const useBlocksStore = create<BlocksState>((set, get) => ({
    entries: emptyEntries(),
    defaults: {...DEFAULT_DETECT_MODE},

    setEntries: (type, entries): Promise<void> => lists.save(type, entries),

    updateEntries: (type, change): Promise<void> => lists.update(type, change),

    addEntry: (type, fields) => get().addEntries(type, [fields]),

    addEntries: async (type, list) => {
        // 같은 content+gallery는 새로 들어온 쪽으로 바꿔 맨 뒤로 보낸다. 바꾸는 항목은 기존 id를 이어 써 사용 기록(core/usage.ts)을 지킨다.
        // 새 항목의 id는 가져온 id가 기존 항목과 겹치지 않게 늘 새로 준다. update의 change는 두 번 불리므로 id는 밖에서 미리 만든다.
        const added = new Map(list.map((fields) => [blockKey(fields), {...fields, id: crypto.randomUUID()}]));
        await lists.update(type, (current) => {
            const kept = new Map(current.map((entry) => [blockKey(entry), entry.id]));
            return [
                ...current.filter((entry) => !added.has(blockKey(entry))),
                ...Array.from(added, ([key, entry]) => ({...entry, id: kept.get(key) ?? entry.id}))
            ];
        });
    },

    updateEntry: async (type, id, fields) => {
        // 다른 탭에서 지웠거나 가져오기로 id가 바뀐 항목이면 새로 넣는다. 아래 수정으로 넘기면 같은 content 항목만 지워지고 수정은 사라진다.
        if (!get().entries[type].some((entry) => entry.id === id)) return get().addEntries(type, [fields]);

        const key = blockKey(fields);
        await lists.update(type, (current) =>
            // 잠금 안에서 읽은 값에서 id가 사라졌다면 다른 탭이 지운 것이므로 그대로 둔다.
            current.some((entry) => entry.id === id)
                ? current.filter((entry) => entry.id === id || blockKey(entry) !== key).map((entry) => (entry.id === id ? {...entry, ...fields, id} : entry))
                : current
        );
    },

    removeEntry: async (type, id) => {
        await lists.update(type, (current) => current.filter((entry) => entry.id !== id));
    },

    setDefault: async (type, mode) => {
        set((state) => ({defaults: {...state.defaults, [type]: mode}}));
        await saveOrReload(blockDefaultsStorage().setValue(get().defaults), lists.load, "차단 목록을 저장하지 못했습니다.");
    }
}));

/** 저장소·백업의 기본 차단 모드. 가져오기·복원 값은 검증 없이 들어오므로 모르는 모드(소문자 등)는 버리고 그 유형은 기본 모드로 둔다. */
export const normalizeDefaults = (value: unknown): Record<BlockType, DetectMode> => {
    const defaults = {...DEFAULT_DETECT_MODE};
    if (!isRecord(value)) return defaults;
    for (const type of BLOCK_TYPES) {
        const mode = value[type];
        if (arrayIncludes(DETECT_MODES, mode)) defaults[type] = mode;
    }
    return defaults;
};

// 값이 없으면 null이고, normalize가 빈 목록·기본 모드로 맞춘다.
const lists = typedListSync({
    types: BLOCK_TYPES,
    keyOf: blockListKey,
    normalize: normalizeBlockList,
    get: (): Record<BlockType, BlockEntry[]> => useBlocksStore.getState().entries,
    set: (entries) => useBlocksStore.setState({entries}),
    failure: "차단 목록을 저장하지 못했습니다.",
    // 목록처럼 같은 값이면 스토어를 건드리지 않는다. 새 객체를 넣으면 차단 모듈이 문서 전체를 다시 판정한다 (setDefault 뒤 돌아온 같은 값, bfcache 복원 등).
    extra: {
        [BLOCK_DEFAULTS_KEY]: (value) => {
            const defaults = normalizeDefaults(value);
            if (!shallow(defaults, useBlocksStore.getState().defaults)) useBlocksStore.setState({defaults});
        }
    },
    lock: "refresher:blocks"
});

/** 저장소 값을 읽고 변경(다른 탭·옵션 페이지)을 감시한다. 여러 번 불러도 한 번만 한다. signal은 콘텐츠 스크립트 컨텍스트의 것이다. */
export const initBlocksStore = lists.start;
