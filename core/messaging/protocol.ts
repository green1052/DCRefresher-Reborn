import {defineExtensionMessaging} from "@webext-core/messaging";

/**
 * 팝업 '현재 페이지'의 토글 하나. 이 페이지에서 도는 모듈의 pageToggles만 담긴다.
 * 아이콘은 컴포넌트라 메시지로 보낼 수 없어 팝업이 모듈 정의에서 찾는다.
 */
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

    /** 탭 → 배경: 디시가 reCAPTCHA v3를 요구하면 그 탭의 MAIN world에서 토큰을 받아 온다. 실패하면 undefined */
    "refresher:grecaptchaToken"(action: "comment_submit" | "insert_icon"): string | undefined;

    /**
     * 탭 → 배경: refresh가 목록 행을 갈아끼웠다. 배경이 그 탭의 MAIN world에서 디시 자체 차단·이용자 메모 표시를 다시 적용한다.
     * 인자는 갤러리 id
     */
    "refresher:listReplaced"(gallery: string): void;

    /** 탭 → 배경: 글쓰기 모듈이 그 탭의 MAIN world에 이미지 변환(features/write/images.ts의 hookUploads)을 넣는다. 페이지마다 한 번 */
    "refresher:hookUploads"(): void;

    /** 팝업 → 탭: 이 페이지의 상태 */
    "refresher:pageState"(): PageToggleState[];

    /** 팝업 → 탭: 이 페이지에서만 토글. 바뀐 상태를 돌려준다 */
    "refresher:pageAction"(action: PageAction): PageToggleState[];
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
