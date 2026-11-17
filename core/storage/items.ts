import {storage, type StorageItemKey, type WxtStorageItem} from "wxt/utils/storage";

import {objectKeys} from "@/utils/typed";

import type {BlockType, DatabaseMeta, DetectMode, MemoType, SettingValue} from "./types";

/** 차단 유형 → 이름. 유형, 모드 목록과 타입(core/storage/types.ts)은 이름표의 키 순서를 따른다. */
export const TYPE_NAMES = {
    NICK: "닉네임",
    ID: "아이디",
    IP: "IP",
    TITLE: "제목",
    TEXT: "내용",
    COMMENT: "댓글",
    DCCON: "디시콘",
    TAB: "말머리",
    IMAGE: "이미지"
};

export const DETECT_MODE_NAMES = {
    SAME: "일치",
    CONTAIN: "포함",
    NOT_SAME: "불일치",
    NOT_CONTAIN: "불포함"
};

export const MEMO_TYPE_NAMES = {
    UID: "아이디",
    NICK: "닉네임",
    IP: "IP"
};

export const BLOCK_TYPES = objectKeys(TYPE_NAMES);
export const DETECT_MODES = objectKeys(DETECT_MODE_NAMES);
export const MEMO_TYPES = objectKeys(MEMO_TYPE_NAMES);

export const DEFAULT_DETECT_MODE: Record<BlockType, DetectMode> = {
    NICK: "SAME",
    ID: "SAME",
    IP: "SAME",
    TITLE: "CONTAIN",
    TEXT: "CONTAIN",
    COMMENT: "CONTAIN",
    DCCON: "SAME",
    TAB: "SAME",
    IMAGE: "SAME"
};

/** defineItem은 만드는 순간 저장소를 읽으므로 항목은 처음 쓸 때 만들어 재사용한다. */
const lazyItem = <T>(key: StorageItemKey, fallback: T): (() => WxtStorageItem<T, {}>) => {
    let item: WxtStorageItem<T, {}> | undefined;
    return () => (item ??= storage.defineItem<T>(key, {fallback}));
};

/** browser.storage.local에 실제로 저장되는 이름 (local: 없이). */
export const rawKey = <K extends string>(key: `local:${K}`): K => key.slice("local:".length) as K;

export const blockListKey = (type: BlockType): `local:refresher:block:${BlockType}` => `local:refresher:block:${type}`;
export const BLOCK_DEFAULTS_KEY = "local:refresher:block:defaults";
export const memoMapKey = (type: MemoType): `local:refresher:memo:${MemoType}` => `local:refresher:memo:${type}`;
export const MODULES_KEY = "local:refresher:modules";

/** 목록, 설정 쓰기의 Web Locks 이름. 스토어와 설정 옮기기가 같은 이름을 써야 직렬되므로 한곳에 둔다. */
export const LIST_LOCKS = {blocks: "refresher:blocks", memos: "refresher:memos", moduleSettings: "refresher:module-settings"} as const;

export const blockDefaultsStorage = lazyItem<Record<BlockType, DetectMode>>(BLOCK_DEFAULTS_KEY, {...DEFAULT_DETECT_MODE});

export const modulesStorage = lazyItem<Record<string, boolean>>(MODULES_KEY, {});

const settingsItems = new Map<string, WxtStorageItem<Record<string, SettingValue>, {}>>();

/** 모듈 설정 키. 읽기만 할 때와 없어진 모듈의 설정을 지울 때는 항목을 만들지 않고 이 키를 쓴다. */
export const moduleSettingsKey = (id: string): `local:refresher:module:${string}:settings` => `local:refresher:module:${id}:settings`;

export const moduleSettingsStorage = (id: string): WxtStorageItem<Record<string, SettingValue>, {}> => {
    let item = settingsItems.get(id);
    if (!item) {
        item = storage.defineItem<Record<string, SettingValue>>(moduleSettingsKey(id), {fallback: {}});
        settingsItems.set(id, item);
    }
    return item;
};

export const settingsKeyModule = (key: string): string | undefined => /^refresher:module:(.+):settings$/.exec(key)?.[1];

/** 모듈 캐시(글댓비 등) 항목. 백업, 내보내기에서는 뺀다 (core/backup.ts). */
export const moduleDataStorage = <T>(id: string, fallback: T): WxtStorageItem<T, {}> =>
    storage.defineItem<T>(moduleDataKey(id), {fallback});

/** 모듈 캐시 키. 읽기, 감시는 항목 대신 이 키로 한다. */
export const moduleDataKey = (id: string): `local:refresher:module:${string}:data` => `local:refresher:module:${id}:data`;

export const moduleKeyModule = (key: string): string | undefined => /^refresher:module:(.+):(?:settings|data)$/.exec(key)?.[1];

/** 차단 목록 키인지 (기본 차단 모드 키는 제외). */
export const isBlockListKey = (key: string): boolean => /^refresher:block:[A-Z]+$/.test(key);

/** IP/밴 DB는 meta, ip, ban 세 키로 나눠 필요한 것만 읽는다 (ip, ban은 각각 수백 KB). */
export const DB_META_KEY = "local:refresher:db:meta";
export const dbMetaStorage = lazyItem<DatabaseMeta>(DB_META_KEY, {version: "", lastUpdate: 0});

/** ip, ban 값은 CompactIpData, BanList의 JSON 문자열. 항목으로 만들면 수백 KB를 바로 읽으므로 키로만 다룬다. */
export const DB_KEYS = {
    ip: "local:refresher:db:ip",
    ban: "local:refresher:db:ban"
} as const;

/** 세 키를 한 번에 써서 읽는 쪽이 새 meta와 옛 ip를 섞어 보지 않게 한다. */
export const writeDatabase = (meta: DatabaseMeta, ip: string, ban: string): Promise<void> =>
    storage.setItems([
        {item: dbMetaStorage(), value: meta},
        {key: DB_KEYS.ip, value: ip},
        {key: DB_KEYS.ban, value: ban}
    ]);

/** 클라우드 백업 상태. refresher:backup:* 키는 백업 대상에서 빠진다. */
let backupDevice: WxtStorageItem<string, {}> | undefined;
export const backupStorage = {
    /** 설정이 바뀌면 잠시 뒤 자동으로 백업. */
    auto: lazyItem<boolean>("local:refresher:backup:auto", false),
    error: lazyItem<string>("local:refresher:backup:error", ""),
    /** 알람이 브라우저 종료로 사라질 수 있어 다음 시작 때 다시 걸게 하는 표시. */
    pending: lazyItem<boolean>("local:refresher:backup:pending", false),
    /** 마지막 초기화, 복원, 가져오기 직전 값. 데이터 탭의 되돌리기가 쓴다. */
    undo: lazyItem<{ data: Record<string, unknown>; createdAt: number } | null>("local:refresher:backup:undo", null),
    /** 이 기기의 id. 클라우드 백업 메타에 남겨 다른 기기 백업인지 가린다. */
    device: (): WxtStorageItem<string, {}> =>
        (backupDevice ??= storage.defineItem<string>("local:refresher:backup:device", {init: () => crypto.randomUUID()}))
};

