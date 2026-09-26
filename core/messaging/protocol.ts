import {defineExtensionMessaging} from "@webext-core/messaging";

/** 팝업 '현재 페이지'의 토글 하나 — 모듈의 pageToggles에서 이 페이지에서 도는 것만. 아이콘은 팝업이 모듈 정의에서 찾는다 */
export interface PageToggleState {
    module: string;
    id: string;
    label: string;
    desc: string;
    on: boolean;
}

export type PageAction = Pick<PageToggleState, "module" | "id">;

interface ProtocolMap {
    /** 배경 → 탭: 단축키 실행 (commands) */
    "refresher:executeShortcut"(data: string): void;

    /** 탭 → 배경: 디시가 reCAPTCHA v3를 요구할 때 그 탭(MAIN world)에서 토큰 받기. 실패하면 undefined */
    "refresher:grecaptchaToken"(action: "comment_submit" | "insert_icon"): string | undefined;

    /** 탭 → 배경: refresh가 목록 행을 갈아끼웠다 — 그 탭(MAIN world)에서 디시의 자체 차단·이용자 메모 표시를 다시 건다. 인자는 갤러리 id */
    "refresher:listReplaced"(gallery: string): void;

    /** 팝업 → 탭: 이 페이지의 상태 */
    "refresher:pageState"(): PageToggleState[];

    /** 팝업 → 탭: 이 페이지에서만 토글. 바뀐 상태를 돌려준다 */
    "refresher:pageAction"(action: PageAction): PageToggleState[];
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
