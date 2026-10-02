import {defineExtensionMessaging} from "@webext-core/messaging";

import type {UsageData, UsageKind} from "@/core/usage";

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
    /** 배경 → 탭: 단축키 실행 (commands). */
    "refresher:executeShortcut"(data: string): void;

    /** 탭 → 배경: 디시가 reCAPTCHA v3를 요구하면 그 탭의 MAIN world에서 토큰을 받아 온다. 실패하면 undefined */
    "refresher:grecaptchaToken"(action: "comment_submit" | "insert_icon"): string | undefined;

    /**
     * 탭 → 배경: refresh·search가 목록 행을 갈아끼우거나 이어 붙였다. 배경이 그 탭의 MAIN world에서 디시 자체 차단·이용자 메모 표시를 다시 적용한다.
     * 인자는 갤러리 id
     */
    "refresher:listReplaced"(gallery: string): void;

    /** 탭 → 배경: 글쓰기 모듈이 그 탭의 MAIN world에 이미지 변환(features/write/images.ts의 hookUploads)을 넣는다. 페이지마다 한 번. */
    "refresher:hookUploads"(): void;

    /** 탭 → 배경: 디시 통합검색 결과 페이지(HTML). search.dcinside.com은 CORS를 열지 않아 콘텐츠 스크립트가 받을 수 없다. */
    "refresher:searchPosts"(query: string): string;

    /** 탭 → 배경: 쓰인 차단 항목·메모 (core/usage). 여러 탭이 동시에 써도 기록을 잃지 않게 배경이 차례로 저장한다. */
    "refresher:markUsed"(batch: UsageData): void;

    /** 옵션 → 배경: 사용 기록을 지금 목록에 맞추고 그 종류의 기록을 돌려준다 (core/usage의 syncUsage). */
    "refresher:syncUsage"(data: { kind: UsageKind; ids: string[] }): Record<string, number>;

    /** 팝업 → 탭: 이 페이지의 토글 상태. */
    "refresher:pageState"(): PageToggleState[];

    /** 팝업 → 탭: 이 페이지에서만 토글. 바뀐 상태를 돌려준다. */
    "refresher:pageAction"(action: PageAction): PageToggleState[];
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
