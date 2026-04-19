/**
 * 공유 상수 정의 파일
 * Shared constants for DCRefresher Reborn
 */

/**
 * 차단 유형 목록
 * 차단 기능에서 사용되는 모든 차단 유형을 정의합니다.
 */
export const BLOCK_TYPES = [
    "NICK",
    "ID", 
    "IP",
    "TITLE",
    "TEXT",
    "COMMENT",
    "DCCON",
    "TAB",
    "IMAGE"
] as const;

/**
 * 차단 유형 타입
 */
export type BlockType = typeof BLOCK_TYPES[number];

/**
 * 차단 감지 모드
 */
export const BLOCK_DETECT_MODES = {
    SAME: "SAME",
    CONTAIN: "CONTAIN",
    NOT_SAME: "NOT_SAME",
    NOT_CONTAIN: "NOT_CONTAIN"
} as const;

/**
 * 메모 유형 목록
 */
export const MEMO_TYPES = ["UID", "NICK", "IP"] as const;

/**
 * 메모 유형 타입
 */
export type MemoType = typeof MEMO_TYPES[number];

/**
 * 시간 관련 상수 (밀리초)
 */
export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000
} as const;

/**
 * 기본 UI 상수
 */
export const UI = {
    DEFAULT_TOAST_DURATION: 3000,
    DEFAULT_DEBOUNCE_DELAY: 150,
    SCROLL_DETECTION_TIMEOUT: 3000
} as const;
