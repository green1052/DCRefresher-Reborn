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
    /** 이미지 항목(IMAGE)의 비슷한 이미지 지문 (utils/imageFingerprint.ts). 움짤은 첫 장면의 것이다. 디코딩하지 못한 이미지는 없다. */
    similar?: string;
    /** 움짤 항목의 나머지 장면 지문. similar와 따로 두어, 이것을 모르는 이전 버전도 similar를 정지 이미지의 지문처럼 쓴다. */
    frames?: string[];
}

export interface MemoEntry {
    text: string;
    color: string;
    /** 이 갤러리에서만 보이는 메모 (없으면 모든 갤러리). */
    gallery?: string;
}

/** IP/밴 DB의 버전과 마지막으로 서버를 확인한 시각. 갱신할 때가 됐는지는 큰 ip·ban 대신 이것만 읽어 판단한다. */
export interface DatabaseMeta {
    version: string;
    lastUpdate: number;
    /** 저장된 IP 데이터의 형식 (core/ipdb.ts의 IP_FORMAT). 없으면 옛 형식. */
    format?: number;
}

/** 밴 목록: 갤러리 이름(갱차 이유로 보인다) → uid[]. */
export type BanList = Record<string, string[]>;

export type SettingValue = boolean | number | string | string[];
