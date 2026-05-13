export const BLOCK_TYPES: RefresherBlockType[] = [
    "NICK",
    "ID",
    "IP",
    "TITLE",
    "TEXT",
    "COMMENT",
    "DCCON",
    "TAB",
    "IMAGE"
];

export const MEMO_TYPES: RefresherMemoType[] = ["UID", "NICK", "IP"];

export const blockStorage = BLOCK_TYPES.reduce((acc, type) => {
    acc[type] = storage.defineItem<RefresherBlockValue[]>(`local:__REFRESHER_BLOCK:${type}`, {
        defaultValue: []
    });
    return acc;
}, {} as Record<RefresherBlockType, ReturnType<typeof storage.defineItem<RefresherBlockValue[]>>>);

export const blockModeStorage = BLOCK_TYPES.reduce((acc, type) => {
    acc[type] = storage.defineItem<RefresherBlockDetectMode>(`local:__REFRESHER_BLOCK:${type}:$MODE`, {
        defaultValue: "SAME" // Default from background.ts
    });
    return acc;
}, {} as Record<RefresherBlockType, ReturnType<typeof storage.defineItem<RefresherBlockDetectMode>>>);

export const memoStorage = MEMO_TYPES.reduce((acc, type) => {
    acc[type] = storage.defineItem<Record<string, RefresherMemoValue>>(`local:__REFRESHER_MEMO:${type}`, {
        defaultValue: {}
    });
    return acc;
}, {} as Record<RefresherMemoType, ReturnType<typeof storage.defineItem<Record<string, RefresherMemoValue>>>>);

export interface ModuleState {
    name: string;
    description?: string;
    enable: boolean;
    require?: string[];
    settings?: Record<string, RefresherSettings>; // Schema
    status?: Record<string, string | number | boolean>; // Values
    url?: RegExp;
}

export const modulesStorage = storage.defineItem<Record<string, ModuleState>>("local:__REFRESHER_MODULES", {
    defaultValue: {}
});

export const settingsStorage = storage.defineItem<Record<string, Record<string, RefresherSettings>>>("local:__REFRESHER_SETTINGS", {
    defaultValue: {}
});
