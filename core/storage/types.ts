
export type BlockType = "NICK" | "ID" | "IP" | "TITLE" | "TEXT" | "COMMENT" | "DCCON" | "TAB";

export type DetectMode = "SAME" | "CONTAIN" | "NOT_SAME" | "NOT_CONTAIN";

export type MemoType = "UID" | "NICK" | "IP";

export interface BlockEntry {
    id: string;
    content: string;
    isRegex: boolean;
    mode?: DetectMode;
    gallery?: string;
    extra?: string;
}

export interface MemoEntry {
    text: string;
    color: string;
    /** 이 갤러리에서만 보이는 메모 (없으면 모든 갤러리) */
    gallery?: string;
}

/** IP/밴 DB의 버전과 받은 시각 — 갱신할 때가 됐는지는 이것만 읽어 본다 */
export interface DatabaseMeta {
    version: string;
    lastUpdate: number;
}

/** 밴 목록: 이유 → uid[] */
export type BanList = Record<string, string[]>;

export type SettingValue = boolean | number | string | string[];
