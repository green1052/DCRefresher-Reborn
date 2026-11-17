import {defineExtensionMessaging} from "@webext-core/messaging";

import type {GallogActivity} from "@/core/gallog";
import type {TurnstileConfig} from "@/core/preview/types";
import type {UsageData, UsageKind} from "@/core/usage";
import type {Sample} from "@/utils/imageFingerprint";

/** 콘텐츠 스크립트→페이지(MAIN world) CustomEvent. 파이어폭스는 객체를 못 읽어 detail은 원시값뿐이다. */
export const LIST_REPLACED_EVENT = "refresher:list-replaced";

/** 팝업 '현재 페이지'의 토글 하나. 이름, 아이콘은 팝업이 모듈 정보에서 따로 찾는다. */
export interface PageToggleState {
    module: string;
    id: string;
    desc: string;
    on: boolean;
}

export type PageAction = Pick<PageToggleState, "module" | "id">;

/** 팝업 '현재 페이지'의 상태. failed는 setup이 던져 멈춘 모듈 id다. */
export interface PageState {
    toggles: PageToggleState[];
    failed: string[];
}

/** 디시 comment.js의 dc_rc_pairs 이름 - 토큰을 받는 쌍을 rc_key로 보낸다. */
export type CommentRcKey = "new" | "new3";

/** reCAPTCHA v3 토큰을 받을 동작 (refresher:grecaptchaToken). */
export type GrecaptchaRequest = { action: "comment_submit" | "comment_delete_submit"; rcKey: CommentRcKey } | { action: "insert_icon" };

/** 미리보기의 Turnstile 확인 창에서 위젯을 그릴 자리. 페이지(MAIN world)가 찾는다. */
export const TURNSTILE_HOST = "data-refresher-turnstile";
/** 확인 창이 닫힐 때 TURNSTILE_HOST에 보내는 이벤트. 기다리던 페이지 쪽이 그만둔다. */
export const TURNSTILE_CANCEL_EVENT = "refresher-turnstile-cancel";

/** refresher:turnstileToken의 결과. 디시 ts_cmt_fields가 보내는 cf-turnstile-response, ts_state, ts_token_ms가 된다. */
export interface TurnstileResult {
    token: string;
    state: string;
    tokenMs: number;
}

/** 이미지 파일의 SHA-256과 비슷한 이미지 표본 (undefined: 미구함, null: 디코딩 실패). */
export interface ImageHashes {
    file: string;
    similar?: Sample[] | null;
}

interface ProtocolMap {
    /** 배경 → 탭: 단축키 실행 (commands). */
    "refresher:executeShortcut"(data: string): void;

    /** 탭 → 배경: MAIN world에서 reCAPTCHA v3 토큰을 받아 온다. 실패하면 undefined. */
    "refresher:grecaptchaToken"(data: GrecaptchaRequest): string | undefined;

    /** 탭 → 배경: MAIN world에서 Turnstile 토큰을 받아 온다. visible이면 미리보기 확인 창에 그려 누를 때까지 기다린다. */
    "refresher:turnstileToken"(data: { config: TurnstileConfig; visible: boolean }): TurnstileResult | undefined;

    /** 탭 → 배경: 페이지마다 한 번 목록 다리를 건다 (LIST_REPLACED_EVENT 수신용). */
    "refresher:installListBridge"(): void;

    /** 탭 → 배경: 글쓰기 모듈이 그 탭의 MAIN world에 이미지 변환(entrypoints/upload-hook.ts)을 넣는다. 페이지마다 한 번. */
    "refresher:hookUploads"(): void;

    /** 탭 → 배경: 디시 통합검색 결과(HTML). search.dcinside.com은 CORS를 열지 않는다. */
    "refresher:searchPosts"(query: string): string;

    /** 탭 → 배경: 갤로그 첫 화면(HTML). CORS 때문에 배경이 받는다. 없는 아이디면 null. */
    "refresher:gallogPage"(id: string): string | null;

    /** 탭 → 배경: 글댓비 조회권. 공유 캐시에 값이 있으면 cached로 주고, 다른 탭이 받는 중이면 mine 없이 돌려준다. */
    "refresher:gallogClaim"(uid: string): {mine: boolean; cached?: GallogActivity};

    /** 탭 → 배경: 글댓비 조회 결과. 실패는 activity 없이 보내 조회권만 푼다. */
    "refresher:gallogResult"(data: {uid: string; activity?: GallogActivity}): void;

    /** 탭 → 배경: 쓰인 차단 항목, 메모. 여러 탭이 동시에 써도 잃지 않게 배경이 차례로 저장한다. */
    "refresher:markUsed"(batch: UsageData): void;

    /** 옵션 → 배경: 사용 기록을 지금 목록에 맞추고 그 종류의 기록을 돌려준다. prune이면 목록에 없는 기록도 버린다 (core/usage.ts의 syncUsage). */
    "refresher:syncUsage"(data: { kind: UsageKind; ids: string[]; prune: boolean }): Record<string, number>;

    /** 배경 → 탭: 우클릭 "이 이미지 차단". 탭이 해시를 구해 목록에 넣는다. */
    "refresher:blockImage"(url: string): void;

    /** 옵션 → 배경: DB "지금 갱신". 배경 한 곳에서 받아 갱신이 겹치지 않게 한다. */
    "refresher:updateDatabase"(): void;

    /** 팝업 → 탭: 이 페이지의 토글 상태와 시작하지 못한 모듈. */
    "refresher:pageState"(): PageState;

    /** 팝업 → 탭: 이 페이지에서만 토글. 바뀐 상태를 돌려준다. */
    "refresher:pageAction"(action: PageAction): PageState;
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
