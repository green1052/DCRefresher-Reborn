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
    gallery?: string;
}

export interface StoredDB {
    version: string;
    lastUpdate: number;
    ip: Record<string, string>;
    ban: Record<string, string[]>;
}

export type SettingValue = boolean | number | string | string[];

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type BackupMeta = number;
