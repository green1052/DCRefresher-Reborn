// ===== 차단 (Block) =====

export const BLOCK_TYPES: RefresherBlockType[] = [
    "NICK",
    "ID",
    "IP",
    "TITLE",
    "TEXT",
    "COMMENT",
    "DCCON",
    "TAB"
];

export const MEMO_TYPES: RefresherMemoType[] = ["UID", "NICK", "IP"];

type StorageItem<T> = ReturnType<typeof storage.defineItem<T>>;

export const blockStorage = BLOCK_TYPES.reduce((acc, type) => {
    acc[type] = storage.defineItem<RefresherBlockValue[]>(`local:refresher:block:${type}`, {
        defaultValue: []
    });
    return acc;
}, {} as Record<RefresherBlockType, StorageItem<RefresherBlockValue[]>>);

export const blockModeStorage = BLOCK_TYPES.reduce((acc, type) => {
    acc[type] = storage.defineItem<RefresherBlockDetectMode>(`local:refresher:block:${type}:mode`, {
        defaultValue: "SAME"
    });
    return acc;
}, {} as Record<RefresherBlockType, StorageItem<RefresherBlockDetectMode>>);

// ===== 메모 (Memo) =====

export const memoStorage = MEMO_TYPES.reduce((acc, type) => {
    acc[type] = storage.defineItem<Record<string, RefresherMemoValue>>(`local:refresher:memo:${type}`, {
        defaultValue: {}
    });
    return acc;
}, {} as Record<RefresherMemoType, StorageItem<Record<string, RefresherMemoValue>>>);

// ===== 모듈 (Module) =====

// 모듈 활성화 상태 (모듈별 개별 key)
export const moduleEnableStorage = (module: string) =>
    storage.defineItem<boolean | null>(`local:refresher:module:${module}:enable`, {defaultValue: null});

// 모듈 data (모듈별 개별 key)
export const moduleDataStorage = (module: string) =>
    storage.defineItem<Record<string, unknown> | null>(`local:refresher:module:${module}:data`, {defaultValue: null});

// 모듈 설정값 (모듈/키별 개별 key)
export const moduleSettingStorage = (module: string, key: string) =>
    storage.defineItem<string | number | boolean | null>(`local:refresher:module:${module}:setting:${key}`, {
        defaultValue: null
    });

// ===== 데이터베이스 (IP/Ban) =====

export const databaseStorage = {
    ip: storage.defineItem<Record<string, string>>("local:refresher:database:ip", {defaultValue: {}}),
    ban: storage.defineItem<Record<string, string[]>>("local:refresher:database:ban", {defaultValue: {}}),
    version: storage.defineItem<string>("local:refresher:database:version", {defaultValue: ""}),
    lastUpdate: storage.defineItem<number>("local:refresher:database:lastUpdate", {defaultValue: 0})
};

// ===== 백업 (Backup) =====

// 클라우드 백업 시각. databaseStorage.lastUpdate(IP/차단 DB 갱신 시각)와 별개 키여야 함.
export const backupStorage = {
    lastUpdate: storage.defineItem<number>("local:refresher:backup:lastUpdate", {defaultValue: 0})
};

// 스토리지 값 초기 로드 + 변경 감시를 한 번에 등록한다.
// 감시를 먼저 등록한 뒤 초기값을 읽는다. 읽는 동안 변경돼도 watch가 놓치지 않는다.
// 반환값: 감시 해제 함수.
export const onStorageValue = <T>(
    item: StorageItem<T>,
    handler: (value: T) => void
): (() => void) => {
    // defaultValue를 항상 지정하므로 null은 키가 지워졌을 때만 나온다. (우리는 지우지 않음)
    const unwatch = item.watch((value) => handler(value as T));
    void (async () => handler((await item.getValue()) as T))();
    return unwatch;
};