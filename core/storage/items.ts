import {storage, type WxtStorageItem} from "wxt/utils/storage";

import type {BlockEntry, BlockType, DatabaseMeta, DetectMode, MemoEntry, MemoType, SettingValue} from "./types";


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

/**
 * IP/밴 DB — 따로 읽게 세 키로 나눈다: 갱신 확인은 meta만, 페이지는 ip만, 밴은 쓸 때만 (수백 KB).
 * ip·ban은 JSON 문자열이다 — 값 약 10만 개짜리 객체 그래프는 읽을 때마다 메인 스레드를 10ms 넘게 막는다. 없으면 ""
 */
export const dbStorage = {
    meta: storage.defineItem<DatabaseMeta>("local:refresher:db:meta", {fallback: {version: "", lastUpdate: 0}}),
    /** core/ipdb의 CompactIpData */
    ip: storage.defineItem<string>("local:refresher:db:ip", {fallback: ""}),
    /** BanList */
    ban: storage.defineItem<string>("local:refresher:db:ban", {fallback: ""})
};

/** 세 키를 한 번에 쓴다 — 받는 쪽이 새 meta와 옛 ip를 섞어 보지 않게. 6.0.0 개발판의 한 키짜리 DB는 이때 지운다 */
export const writeDatabase = async (meta: DatabaseMeta, ip: string, ban: string): Promise<void> => {
    await storage.setItems([
        {item: dbStorage.meta, value: meta},
        {item: dbStorage.ip, value: ip},
        {item: dbStorage.ban, value: ban}
    ]);
    await storage.removeItem("local:refresher:db");
};

/** 클라우드 백업 상태 — refresher:backup:* 키는 백업 대상에서 빠진다 (core/backup.ts). 백업 시각은 클라우드의 메타에서 읽는다 */
export const backupStorage = {
    /** 설정이 바뀌면 잠시 뒤 자동으로 백업 */
    auto: storage.defineItem<boolean>("local:refresher:backup:auto", {fallback: false}),
    /** 마지막 백업이 실패했으면 이유 (성공하면 빈 문자열) */
    error: storage.defineItem<string>("local:refresher:backup:error", {fallback: ""}),
    /** 자동 백업 알람을 걸어 두고 아직 울리지 않았다 — 브라우저를 끄면 알람이 사라질 수 있어 다음 시작 때 다시 건다 */
    pending: storage.defineItem<boolean>("local:refresher:backup:pending", {fallback: false})
};
