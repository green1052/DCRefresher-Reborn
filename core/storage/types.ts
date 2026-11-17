import type {DETECT_MODE_NAMES, MEMO_TYPE_NAMES, TYPE_NAMES} from "./items";

export type BlockType = keyof typeof TYPE_NAMES;

export type DetectMode = keyof typeof DETECT_MODE_NAMES;

export type MemoType = keyof typeof MEMO_TYPE_NAMES;

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
    /** 이 갤러리에서만 보이는 메모 (없으면 모든 갤러리). */
    gallery?: string;
    /** 추가한 시각(ms). 옛 메모에는 없다. */
    added?: number;
}

/** IP/밴 DB의 버전과 마지막 확인 시각. 갱신 여부는 큰 ip, ban 대신 이것만 읽는다. */
export interface DatabaseMeta {
    version: string;
    lastUpdate: number;
    /** 저장된 IP 데이터의 형식 (core/ipdb.ts의 IP_FORMAT). 없으면 옛 형식. */
    format?: number;
}

/** 밴 목록: 갤러리 이름(갱차 이유로 보인다) → uid[]. */
export type BanList = Record<string, string[]>;

export type SettingValue = boolean | number | string | string[];
