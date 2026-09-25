import {defineExtensionMessaging} from "@webext-core/messaging";

/** 팝업이 보여 주는 이 페이지의 상태. 모듈이 꺼져 있거나 이 페이지에서 안 돌면 null */
export interface PageState {
    refresh: { paused: boolean } | null;
    stealth: { revealed: boolean } | null;
    /** 이 페이지에서만 차단 내용 보기와 가린 요소 수 */
    block: { revealed: boolean; hidden: number } | null;
}

export type PageAction = "toggleRefresh" | "toggleStealth" | "toggleBlockReveal";

interface ProtocolMap {
    /** 배경 → 탭: 단축키 실행 (commands) */
    "refresher:executeShortcut"(data: string): void;

    /** 탭 → 배경: 디시가 reCAPTCHA v3를 요구할 때 그 탭(MAIN world)에서 토큰 받기. 실패하면 undefined */
    "refresher:grecaptchaToken"(action: "comment_submit" | "insert_icon"): string | undefined;

    /** 탭 → 배경: refresh가 목록 행을 갈아끼웠다 — 그 탭(MAIN world)에서 디시의 자체 차단·이용자 메모 표시를 다시 건다. 인자는 갤러리 id */
    "refresher:listReplaced"(gallery: string): void;

    /** 팝업 → 탭: 이 페이지의 상태 */
    "refresher:pageState"(): PageState;

    /** 팝업 → 탭: 이 페이지에서만 토글. 바뀐 상태를 돌려준다 */
    "refresher:pageAction"(action: PageAction): PageState;
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
