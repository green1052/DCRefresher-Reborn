
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

/** IP/밴 DB의 버전과 마지막으로 서버를 확인한 시각. 갱신할 때가 됐는지는 큰 ip·ban 대신 이것만 읽어 판단한다 */
export interface DatabaseMeta {
    version: string;
    lastUpdate: number;
    /** 저장된 IP 데이터의 형식 (core/ipdb의 IP_FORMAT). 없으면 옛 형식 */
    format?: number;
}

/** 밴 목록: 이유 → uid[] */
export type BanList = Record<string, string[]>;

export type SettingValue = boolean | number | string | string[];
