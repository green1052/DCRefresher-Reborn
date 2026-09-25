import type {BlockEntry, BlockType, DetectMode, JsonValue, MemoEntry, MemoType, SettingValue, StoredDB} from "./types";


export const BLOCK_TYPES: BlockType[] = ["NICK", "ID", "IP", "TITLE", "TEXT", "COMMENT", "DCCON", "TAB"];

export const MEMO_TYPES: MemoType[] = ["UID", "NICK", "IP"];

export const DETECT_MODES: DetectMode[] = ["SAME", "CONTAIN", "NOT_SAME", "NOT_CONTAIN"];

export const TYPE_NAMES: Record<BlockType, string> = {
    NICK: "닉네임",
    ID: "아이디",
    IP: "IP",
    TITLE: "제목",
    TEXT: "내용",
    COMMENT: "댓글",
    DCCON: "디시콘",
    TAB: "말머리"
};

export const DETECT_MODE_NAMES: Record<DetectMode, string> = {
    SAME: "일치",
    CONTAIN: "포함",
    NOT_SAME: "불일치",
    NOT_CONTAIN: "불포함"
};

export const MEMO_TYPE_NAMES: Record<MemoType, string> = {
    UID: "유저 ID",
    NICK: "닉네임",
    IP: "IP"
};

export const DEFAULT_DETECT_MODE: Record<BlockType, DetectMode> = {
    NICK: "SAME",
    ID: "SAME",
    IP: "SAME",
    TITLE: "CONTAIN",
    TEXT: "CONTAIN",
    COMMENT: "CONTAIN",
    DCCON: "SAME",
    TAB: "SAME"
};

/** storage.local 키 하나 — getValue/setValue/watch만 쓴다 */
export interface StorageItem<T> {
    getValue(): Promise<T>;
    setValue(value: T): Promise<void>;
    /** 값이 바뀌면 (새 값, 이전 값) — 없으면 fallback. 해제 함수를 돌려준다 */
    watch(callback: (next: T, previous: T) => void): () => void;
}

/** WXT defineItem은 정의할 때마다 값을 한 번 몰래 읽어(init 확인) 페이지마다 저장소 읽기가 두 배가 된다 — 필요한 것만 직접 */
const item = <T>(key: string, fallback: T): StorageItem<T> => ({
    getValue: async () => ((await browser.storage.local.get(key))[key] as T | undefined) ?? fallback,
    setValue: (value) => browser.storage.local.set({[key]: value}),
    watch: (callback) => {
        const listener = (changes: Record<string, Browser.storage.StorageChange>): void => {
            const change = changes[key];
            // 파이어폭스는 같은 값을 다시 써도 알린다 — WXT watch처럼 거른다
            if (!change || JSON.stringify(change.newValue) === JSON.stringify(change.oldValue)) return;
            callback((change.newValue as T | undefined) ?? fallback, (change.oldValue as T | undefined) ?? fallback);
        };
        browser.storage.local.onChanged.addListener(listener);
        return () => browser.storage.local.onChanged.removeListener(listener);
    }
});

export const blockStorage = Object.fromEntries(
    BLOCK_TYPES.map((type) => [type, item<BlockEntry[]>(`refresher:block:${type}`, [])])
) as Record<BlockType, StorageItem<BlockEntry[]>>;

export const blockDefaultsStorage = item<Record<BlockType, DetectMode>>("refresher:block:defaults", {...DEFAULT_DETECT_MODE});

export const memoStorage = Object.fromEntries(
    MEMO_TYPES.map((type) => [type, item<Record<string, MemoEntry>>(`refresher:memo:${type}`, {})])
) as Record<MemoType, StorageItem<Record<string, MemoEntry>>>;

export const modulesStorage = item<Record<string, boolean>>("refresher:modules", {});

export const moduleSettingsStorage = (id: string) => item<Record<string, SettingValue>>(`refresher:module:${id}:settings`, {});

export const moduleDataStorage = (id: string) => item<Record<string, JsonValue>>(`refresher:module:${id}:data`, {});

export const dbStorage = item<StoredDB>("refresher:db", {version: "", lastUpdate: 0, ip: null, ban: {}});

/** 클라우드 백업 상태 — refresher:backup:* 키는 백업 대상에서 빠진다 (core/backup.ts). 백업 시각은 클라우드의 메타에서 읽는다 */
export const backupStorage = {
    /** 설정이 바뀌면 잠시 뒤 자동으로 백업 */
    auto: item("refresher:backup:auto", false),
    /** 마지막 백업이 실패했으면 이유 (성공하면 빈 문자열) */
    error: item("refresher:backup:error", "")
};
