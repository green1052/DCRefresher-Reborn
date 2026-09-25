import {defineExtensionMessaging} from "@webext-core/messaging";

/** 팝업이 보여 주는 이 페이지의 상태. 모듈이 꺼져 있거나 이 페이지에서 안 돌면 null */
export interface PageState {
    refresh: { paused: boolean } | null;
    stealth: { revealed: boolean } | null;
    /** 페이지 제목의 갤러리 이름 (못 찾으면 null) */
    galleryName: string | null;
}

export type PageAction = "toggleRefresh" | "toggleStealth";

interface ProtocolMap {
    /** 배경 → 탭: 단축키 실행 (commands) */
    "refresher:executeShortcut"(data: string): void;

    /** 탭 → 배경: 디시가 reCAPTCHA v3를 요구할 때 그 탭(MAIN world)에서 토큰 받기. 실패하면 undefined */
    "refresher:grecaptchaToken"(action: "comment_submit" | "insert_icon"): string | undefined;

    /** 팝업 → 탭: 이 페이지의 상태 */
    "refresher:pageState"(): PageState;

    /** 팝업 → 탭: 이 페이지에서만 토글. 바뀐 상태를 돌려준다 */
    "refresher:pageAction"(action: PageAction): PageState;
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
