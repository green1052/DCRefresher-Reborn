import {storage, type WxtStorageItem} from "wxt/utils/storage";

import type {BlockEntry, BlockType, DetectMode, MemoEntry, MemoType, SettingValue, StoredDB} from "./types";


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

export const blockStorage = Object.fromEntries(
    BLOCK_TYPES.map((type) => [type, storage.defineItem<BlockEntry[]>(`local:refresher:block:${type}`, {fallback: []})])
) as Record<BlockType, WxtStorageItem<BlockEntry[], {}>>;

export const blockDefaultsStorage = storage.defineItem<Record<BlockType, DetectMode>>("local:refresher:block:defaults", {
    fallback: {...DEFAULT_DETECT_MODE}
});

export const memoStorage = Object.fromEntries(
    MEMO_TYPES.map((type) => [type, storage.defineItem<Record<string, MemoEntry>>(`local:refresher:memo:${type}`, {fallback: {}})])
) as Record<MemoType, WxtStorageItem<Record<string, MemoEntry>, {}>>;

export const modulesStorage = storage.defineItem<Record<string, boolean>>("local:refresher:modules", {fallback: {}});

export const moduleSettingsStorage = (id: string) =>
    storage.defineItem<Record<string, SettingValue>>(`local:refresher:module:${id}:settings`, {fallback: {}});

export const dbStorage = storage.defineItem<StoredDB>("local:refresher:db", {
    fallback: {version: "", lastUpdate: 0, ip: null, ban: {}}
});

/** 클라우드 백업 상태 — refresher:backup:* 키는 백업 대상에서 빠진다 (core/backup.ts). 백업 시각은 클라우드의 메타에서 읽는다 */
export const backupStorage = {
    /** 설정이 바뀌면 잠시 뒤 자동으로 백업 */
    auto: storage.defineItem<boolean>("local:refresher:backup:auto", {fallback: false}),
    /** 마지막 백업이 실패했으면 이유 (성공하면 빈 문자열) */
    error: storage.defineItem<string>("local:refresher:backup:error", {fallback: ""}),
    /** 자동 백업 알람을 걸어 두고 아직 울리지 않았다 — 브라우저를 끄면 알람이 사라질 수 있어 다음 시작 때 다시 건다 */
    pending: storage.defineItem<boolean>("local:refresher:backup:pending", {fallback: false})
};
