import type {CompactIpData} from "@/core/ipdb";

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

/** IP/밴 DB */
export interface Database {
    version: string;
    lastUpdate: number;
    /** IP 대역 정보 (core/ipdb의 저장 형식). 아직 못 받았으면 null */
    ip: CompactIpData | null;
    /** 이유 → uid[] */
    ban: Record<string, string[]>;
}

/**
 * 저장된 DB — ip·ban은 JSON 문자열이다. 값 약 10만 개짜리 객체 그래프는 읽을 때마다 메인 스레드를 10ms 넘게 막는다.
 * 6.0.0 개발판은 객체로 저장했다 (core/database의 parseDB가 둘 다 읽는다)
 */
export interface StoredDB extends Omit<Database, "ip" | "ban"> {
    ip: string | Database["ip"];
    ban: string | Database["ban"];
}

export type SettingValue = boolean | number | string | string[];

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
