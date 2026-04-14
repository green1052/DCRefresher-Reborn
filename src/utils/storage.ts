import {BLOCK_TYPES as BLOCK_TYPES_CONST, MEMO_TYPES as MEMO_TYPES_CONST} from "./constants";

export const BLOCK_TYPES: RefresherBlockType[] = [...BLOCK_TYPES_CONST];

export const MEMO_TYPES: RefresherMemoType[] = [...MEMO_TYPES_CONST];

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

interface ModuleState {
    name: string;
    description?: string;
    enable: boolean;
    require?: string[];
    settings?: Record<string, any>; // Schema
    status?: Record<string, any>; // Values
    url?: RegExp;
}

export const modulesStorage = storage.defineItem<Record<string, ModuleState>>("local:__REFRESHER_MODULES", {
    defaultValue: {}
});

export const settingsStorage = storage.defineItem<Record<string, Record<string, RefresherSettings>>>("local:__REFRESHER_SETTINGS", {
    defaultValue: {}
});
