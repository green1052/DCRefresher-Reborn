import {storage, type WxtStorageItem} from "wxt/utils/storage";

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

const blockItem = (type: BlockType) =>
    storage.defineItem<BlockEntry[]>(`local:refresher:block:${type}`, {defaultValue: []});

export const blockStorage = Object.fromEntries(
    BLOCK_TYPES.map((type) => [type, blockItem(type)])
) as Record<BlockType, WxtStorageItem<BlockEntry[], {}>>;

export const blockDefaultsStorage = storage.defineItem<Record<BlockType, DetectMode>>("local:refresher:block:defaults", {
    defaultValue: {...DEFAULT_DETECT_MODE}
});

export const memoStorage = Object.fromEntries(
    MEMO_TYPES.map((type) => [type, storage.defineItem<Record<string, MemoEntry>>(`local:refresher:memo:${type}`, {defaultValue: {}})])
) as Record<MemoType, WxtStorageItem<Record<string, MemoEntry>, {}>>;

export const modulesStorage = storage.defineItem<Record<string, boolean>>("local:refresher:modules", {defaultValue: {}});

export const moduleSettingsStorage = (id: string) =>
    storage.defineItem<Record<string, SettingValue>>(`local:refresher:module:${id}:settings`, {defaultValue: {}});

export const moduleDataStorage = (id: string) =>
    storage.defineItem<Record<string, JsonValue>>(`local:refresher:module:${id}:data`, {defaultValue: {}});

export const dbStorage = storage.defineItem<StoredDB>("local:refresher:db", {
    defaultValue: {version: "", lastUpdate: 0, ip: {}, ban: {}}
});

export const backupStorage = {
    lastUpdate: storage.defineItem<number>("local:refresher:backup:lastUpdate", {defaultValue: 0})
};
