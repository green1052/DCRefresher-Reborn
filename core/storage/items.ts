import {storage, type StorageItemKey, type WxtStorageItem} from "wxt/utils/storage";

import {objectKeys} from "@/utils/typed";

import type {BlockType, DatabaseMeta, DetectMode, MemoType, SettingValue} from "./types";

/** 차단 유형 → 이름. 유형·모드 목록과 타입(types.ts)은 이름표의 키 순서를 따른다. */
export const TYPE_NAMES = {
    NICK: "닉네임",
    ID: "아이디",
    IP: "IP",
    TITLE: "제목",
    TEXT: "내용",
    COMMENT: "댓글",
    DCCON: "디시콘",
    TAB: "말머리"
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
    TAB: "SAME"
};

/**
 * defineItem은 만드는 순간 저장소를 한 번 읽는다 (@wxt-dev/storage의 getOrInitValue). 이 파일은 콘텐츠 스크립트·배경·옵션·팝업이
 * 모두 불러오므로, 모듈 최상위에서 만들면 디시 페이지마다·서비스 워커가 깰 때마다 쓰지도 않는 키를 십여 번 읽는다.
 * 그래서 항목은 처음 쓸 때 만들어 재사용한다. 읽기만 하는 곳(콘텐츠 스크립트의 스토어·레지스트리)은 항목을 만들지 않고
 * 키로 storage.getItems·storage.watch를 써서 한 번의 storage.local.get으로 여러 키를 읽는다.
 */
const lazyItem = <T>(key: StorageItemKey, fallback: T): (() => WxtStorageItem<T, {}>) => {
    let item: WxtStorageItem<T, {}> | undefined;
    return () => (item ??= storage.defineItem<T>(key, {fallback}));
};

/**
 * browser.storage.local에 실제로 저장되는 이름 (local: 없이). 백업·가져오기처럼 storage.local을 직접 다룰 때 쓴다.
 * WXT 키에서 만들어 두 이름이 어긋나지 않게 한다.
 */
export const rawKey = <K extends string>(key: `local:${K}`): K => key.slice("local:".length) as K;

export const blockListKey = (type: BlockType): `local:refresher:block:${BlockType}` => `local:refresher:block:${type}`;
export const BLOCK_DEFAULTS_KEY = "local:refresher:block:defaults";
export const memoMapKey = (type: MemoType): `local:refresher:memo:${MemoType}` => `local:refresher:memo:${type}`;
export const MODULES_KEY = "local:refresher:modules";

/** 기본 차단 모드 항목 (쓰기용). moduleSettingsStorage처럼 처음 쓸 때 만든다. */
export const blockDefaultsStorage = lazyItem<Record<BlockType, DetectMode>>(BLOCK_DEFAULTS_KEY, {...DEFAULT_DETECT_MODE});

/** 모듈 on/off 항목 (쓰기·감시용). */
export const modulesStorage = lazyItem<Record<string, boolean>>(MODULES_KEY, {});

const settingsItems = new Map<string, WxtStorageItem<Record<string, SettingValue>, {}>>();

/** 모듈 설정 키. 읽기만 할 때와 없어진 모듈의 설정을 지울 때는 항목을 만들지 않고 이 키를 쓴다. */
export const moduleSettingsKey = (id: string): `local:refresher:module:${string}:settings` => `local:refresher:module:${id}:settings`;

/** 모듈 설정 항목 (쓰기용). 모듈마다 하나를 만들어 재사용한다. */
export const moduleSettingsStorage = (id: string): WxtStorageItem<Record<string, SettingValue>, {}> => {
    let item = settingsItems.get(id);
    if (!item) {
        item = storage.defineItem<Record<string, SettingValue>>(moduleSettingsKey(id), {fallback: {}});
        settingsItems.set(id, item);
    }
    return item;
};

/** 모듈 설정 키면 그 모듈 id, 아니면 undefined (local: 없이). */
export const settingsKeyModule = (key: string): string | undefined => /^refresher:module:(.+):settings$/.exec(key)?.[1];

/** 모듈 캐시(글댓비 등). 백업·내보내기에는 넣지 않는다 (core/backup.ts의 isBackupTarget). 만드는 순간 값을 읽으므로 쓰는 모듈의 setup에서 만든다. */
export const moduleDataStorage = <T>(id: string, fallback: T): WxtStorageItem<T, {}> =>
    storage.defineItem<T>(moduleDataKey(id), {fallback});

/** 모듈 캐시 키. 감시만 할 때는 항목 대신 이 키를 쓴다 (core/storage/sync의 watchStorage). */
export const moduleDataKey = (id: string): `local:refresher:module:${string}:data` => `local:refresher:module:${id}:data`;

/** 모듈 설정·캐시 키(local: 없이)의 모듈 id. 둘 다 아니면 undefined. */
export const moduleKeyModule = (key: string): string | undefined => /^refresher:module:(.+):(?:settings|data)$/.exec(key)?.[1];

/** 차단 목록 키(blockListKey)인지 (local: 없이). 기본 차단 모드(refresher:block:defaults)는 아니다. */
export const isBlockListKey = (key: string): boolean => /^refresher:block:[A-Z]+$/.test(key);

/**
 * IP/밴 DB는 필요한 것만 읽도록 세 키로 나눈다: 갱신 확인은 meta, 페이지는 ip, 밴은 쓸 때만 ban (ip·ban은 각각 수백 KB).
 */
const dbMeta = lazyItem<DatabaseMeta>("local:refresher:db:meta", {version: "", lastUpdate: 0});
export const dbStorage = {
    get meta() {
        return dbMeta();
    }
};

/**
 * ip·ban 키. defineItem은 만드는 순간 값을 한 번 읽으므로, 여기서 만들면 이 파일을 불러오는 모든 페이지·서비스 워커가
 * 쓰지도 않는 수백 KB를 읽는다. 쓰는 곳(core/database)에서 storage.getItem·watch로 다룬다.
 * 값은 CompactIpData(core/ipdb)·BanList의 JSON 문자열이고, 없으면 ""다. ip는 서버(ip.json)가 준 문자열 그대로다.
 * 객체로 두면 값 약 10만 개짜리 객체 그래프를 읽을 때마다 메인 스레드가 10ms 넘게 막힌다.
 */
export const DB_KEYS = {
    ip: "local:refresher:db:ip",
    ban: "local:refresher:db:ban"
} as const;

/** 세 키를 한 번에 써서 읽는 쪽이 새 meta와 옛 ip를 섞어 보지 않게 한다. */
export const writeDatabase = (meta: DatabaseMeta, ip: string, ban: string): Promise<void> =>
    storage.setItems([
        {item: dbStorage.meta, value: meta},
        {key: DB_KEYS.ip, value: ip},
        {key: DB_KEYS.ban, value: ban}
    ]);

/** 클라우드 백업 상태. refresher:backup:* 키는 백업 대상에서 빠진다 (core/backup.ts). 백업 시각은 클라우드의 메타에서 읽는다. */
const backupAuto = lazyItem<boolean>("local:refresher:backup:auto", false);
const backupError = lazyItem<string>("local:refresher:backup:error", "");
const backupPending = lazyItem<boolean>("local:refresher:backup:pending", false);
export const backupStorage = {
    /** 설정이 바뀌면 잠시 뒤 자동으로 백업. */
    get auto() {
        return backupAuto();
    },
    /** 마지막 백업이 실패했으면 이유 (성공하면 빈 문자열). */
    get error() {
        return backupError();
    },
    /** 자동 백업 알람이 걸려 있고 아직 울리지 않았다. 브라우저를 끄면 알람이 사라질 수 있어 다음 시작 때 이 값을 보고 다시 건다. */
    get pending() {
        return backupPending();
    }
};
