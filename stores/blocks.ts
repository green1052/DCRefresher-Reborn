import {create} from "zustand";
import {shallow} from "zustand/shallow";

import {BLOCK_DEFAULTS_KEY, BLOCK_TYPES, blockDefaultsStorage, blockListKey} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {typedListSync} from "@/core/storage/sync";
import {saveOrReload} from "@/utils/error";

// 검사·정규화는 core/block-list에 두고 여기서 다시 꺼낸다. 옵션·테스트가 stores/blocks에서 그대로 찾는다.
export {blockKey, composeExtra, normalizeBlockList, normalizeDefaults, type BlockInputFields} from "@/core/block-list";
import {blockKey, normalizeBlockList, normalizeDefaults, type BlockInputFields} from "@/core/block-list";

interface BlocksState {
    entries: Record<BlockType, BlockEntry[]>;
    defaults: Record<BlockType, DetectMode>;
    /** 저장소의 현재 값에 change를 붙여 쓴다 (가져오기·여러 개 지우기). */
    updateEntries: (type: BlockType, change: (entries: BlockEntry[]) => BlockEntry[]) => Promise<void>;
    addEntry: (type: BlockType, fields: BlockInputFields) => Promise<void>;
    /** 여러 항목을 한 번의 쓰기로. */
    addEntries: (type: BlockType, list: BlockInputFields[]) => Promise<void>;
    updateEntry: (type: BlockType, id: string, fields: BlockInputFields) => Promise<void>;
    removeEntry: (type: BlockType, id: string) => Promise<void>;
    setDefault: (type: BlockType, mode: DetectMode) => Promise<void>;
}

/** 항목을 사람에게 보일 이름. 디시콘은 코드 대신 이름(extra)을 쓴다. */
export const blockLabel = (type: BlockType, entry: BlockEntry): string => (type === "DCCON" ? entry.extra || entry.content : entry.content);

/** 유형마다 빈 차단 목록. 유형을 늘리면 여기서 타입 오류가 난다. */
export const emptyEntries = (): Record<BlockType, BlockEntry[]> => ({COMMENT: [], DCCON: [], ID: [], IMAGE: [], IP: [], NICK: [], TAB: [], TEXT: [], TITLE: []});

/** 차단 목록/기본 모드의 단일 출처. 콘텐츠·옵션 모두 이 스토어를 쓰고 저장소와 양방향 동기화된다. */
export const useBlocksStore = create<BlocksState>((set, get) => ({
    entries: emptyEntries(),
    defaults: normalizeDefaults(null),

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
