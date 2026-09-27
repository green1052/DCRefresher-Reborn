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

const settingsItems = new Map<string, WxtStorageItem<Record<string, SettingValue>, {}>>();

/** 모듈 설정 — 모듈마다 항목 하나를 만들어 두고 같이 쓴다 (부를 때마다 만들면 watch 리스너가 쌓인다) */
export const moduleSettingsStorage = (id: string): WxtStorageItem<Record<string, SettingValue>, {}> => {
    let item = settingsItems.get(id);
    if (!item) {
        item = storage.defineItem<Record<string, SettingValue>>(`local:refresher:module:${id}:settings`, {fallback: {}});
        settingsItems.set(id, item);
    }
    return item;
};

/** 모듈 캐시(글댓비 등) — 백업·내보내기에서 빠진다 (isModuleDataKey). 쓰는 모듈이 한 번만 만든다 */
export const moduleDataStorage = <T>(id: string, fallback: T): WxtStorageItem<T, {}> =>
    storage.defineItem<T>(`local:refresher:module:${id}:data`, {fallback});

/** moduleDataStorage의 키인지 (local: 없이) */
export const isModuleDataKey = (key: string): boolean => /^refresher:module:.+:data$/.test(key);

/**
 * 비회원 댓글 닉네임·비밀번호 — 확장 저장소에만 둔다 (페이지 스크립트가 못 읽게). 비밀번호가 평문이라 백업·내보내기에서 빠진다.
 * 댓글 쓰기가 저장하고, 댓글 삭제가 먼저 내민다
 */
export const nonmemberStorage = storage.defineItem<{ nick: string; pw: string }>("local:refresher:nonmember", {fallback: {nick: "", pw: ""}});

/**
 * IP/밴 DB — 따로 읽게 세 키로 나눈다: 갱신 확인은 meta만, 페이지는 ip만, 밴은 쓸 때만 (수백 KB).
 * ip·ban은 JSON 문자열이다 — 값 약 10만 개짜리 객체 그래프는 읽을 때마다 메인 스레드를 10ms 넘게 막는다. 없으면 ""
 */
export const dbStorage = {
    meta: storage.defineItem<DatabaseMeta>("local:refresher:db:meta", {fallback: {version: "", lastUpdate: 0}})
};

/**
 * ip·ban 키 — 여기서 defineItem으로 만들어 두지 않는다. defineItem은 만드는 순간 값을 한 번 읽어서,
 * 이 파일을 불러오는 모든 페이지·서비스 워커가 쓰지도 않는 수백 KB를 읽게 된다. 쓰는 곳에서 storage.getItem·watch로 다룬다.
 * ip는 core/ipdb의 CompactIpData, ban은 BanList를 JSON으로 담는다
 */
export const DB_KEYS = {
    ip: "local:refresher:db:ip",
    ban: "local:refresher:db:ban"
} as const;

/** 세 키를 한 번에 쓴다 — 받는 쪽이 새 meta와 옛 ip를 섞어 보지 않게. 6.0.0 개발판의 한 키짜리 DB는 이때 지운다 */
export const writeDatabase = async (meta: DatabaseMeta, ip: string, ban: string): Promise<void> => {
    await storage.setItems([
        {item: dbStorage.meta, value: meta},
        {key: DB_KEYS.ip, value: ip},
        {key: DB_KEYS.ban, value: ban}
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
