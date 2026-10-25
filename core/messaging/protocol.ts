import {defineExtensionMessaging} from "@webext-core/messaging";

import type {TurnstileConfig} from "@/core/preview/types";
import type {UsageData, UsageKind} from "@/core/usage";
import type {Sample} from "@/utils/imageFingerprint";

/**
 * 콘텐츠 스크립트가 목록을 바꾼 뒤 페이지(MAIN world)에 보내는 CustomEvent 이름 (refresher:installListBridge가 건 다리가 받는다).
 * detail은 갤러리 id 문자열이다. 파이어폭스에서 콘텐츠 스크립트의 객체는 페이지가 읽지 못하므로 원시값만 넘긴다.
 */
export const LIST_REPLACED_EVENT = "refresher:list-replaced";

/**
 * 팝업 '현재 페이지'의 토글 하나. 이 페이지에서 도는 모듈의 pageToggles만 담긴다.
 * 아이콘(컴포넌트)과 이름은 팝업이 모듈 정보(features/<id>/icons.ts·labels.ts)에서 찾는다. 이름을 콘텐츠 번들에 두지 않으려고 보내지 않는다.
 */
export interface PageToggleState {
    module: string;
    id: string;
    desc: string;
    on: boolean;
}

export type PageAction = Pick<PageToggleState, "module" | "id">;

/** 팝업 '현재 페이지'의 상태. failed는 이 페이지에서 setup이 던져 멈춘 모듈 id다 (껐다 켜거나 새로고침할 때까지 다시 시작하지 않는다). */
export interface PageState {
    toggles: PageToggleState[];
    failed: string[];
}

/** 디시 comment.js의 dc_rc_pairs 이름. 글 댓글은 이 쌍의 v3 키로 토큰을 받고, 서버가 같은 쌍의 비밀키로 확인하게 rc_key로 보낸다. */
export type CommentRcKey = "new" | "new3";

/** reCAPTCHA v3 토큰을 받을 동작 (refresher:grecaptchaToken). */
export type GrecaptchaRequest = { action: "comment_submit" | "comment_delete_submit"; rcKey: CommentRcKey } | { action: "insert_icon" };

/** 미리보기의 Turnstile 확인 창에서 위젯을 그릴 자리 (오버레이 shadow 안). 페이지(MAIN world)가 이것으로 찾는다. */
export const TURNSTILE_HOST = "data-refresher-turnstile";
/** 확인 창이 닫힐 때 TURNSTILE_HOST에 보내는 이벤트. 기다리던 페이지 쪽이 그만둔다. */
export const TURNSTILE_CANCEL_EVENT = "refresher-turnstile-cancel";

/** refresher:turnstileToken의 결과. 디시 ts_cmt_fields가 보내는 cf-turnstile-response·ts_state·ts_token_ms가 된다. */
export interface TurnstileResult {
    token: string;
    state: string;
    tokenMs: number;
}

/**
 * 이미지 파일의 SHA-256과 비슷한 이미지 표본 (utils/imageFingerprint.ts의 imageFingerprints: 정지 이미지는 하나, 움짤은 장면마다 하나).
 * 표본은 구하지 않았으면 undefined, 디코딩하지 못했으면 null이다.
 */
export interface ImageHashes {
    file: string;
    similar?: Sample[] | null;
}

interface ProtocolMap {
    /** 배경 → 탭: 단축키 실행 (commands). */
    "refresher:executeShortcut"(data: string): void;

    /**
     * 탭 → 배경: 디시가 reCAPTCHA v3를 요구하면 그 탭의 MAIN world에서 토큰을 받아 온다. 실패하면 undefined다.
     * 글 댓글 작성·삭제(comment_submit, comment_delete_submit)는 rc_key로 보낸 쌍의 키로, 디시콘·글자콘(insert_icon)은 예전 키로 받는다.
     */
    "refresher:grecaptchaToken"(data: GrecaptchaRequest): string | undefined;

    /**
     * 탭 → 배경: 글 페이지가 댓글 Turnstile을 켰으면(_TS_CMT_) 그 탭의 MAIN world에서 토큰을 받아 온다. 실패하면 undefined다.
     * visible이 false면 보이지 않게 그려, 확인을 눌러야 하면(interactive) 기다리지 않고 돌아온다.
     * true면 미리보기의 확인 창(TURNSTILE_HOST)에 그려 누를 때까지 기다리고, 창이 닫히면(TURNSTILE_CANCEL_EVENT) 빈 토큰으로 돌아온다.
     */
    "refresher:turnstileToken"(data: { config: TurnstileConfig; visible: boolean }): TurnstileResult | undefined;

    /**
     * 탭 → 배경: 그 탭의 MAIN world에 목록 다리를 건다. 페이지마다 한 번.
     * 다리는 refresh·search가 목록 행을 갈아끼우거나 이어 붙일 때 보내는 LIST_REPLACED_EVENT를 받아 디시 자체 차단·이용자 메모 표시를 다시 적용한다.
     */
    "refresher:installListBridge"(): void;

    /** 탭 → 배경: 글쓰기 모듈이 그 탭의 MAIN world에 이미지 변환(entrypoints/upload-hook.ts)을 넣는다. 페이지마다 한 번. */
    "refresher:hookUploads"(): void;

    /** 탭 → 배경: 디시 통합검색 결과 페이지(HTML). search.dcinside.com은 CORS를 열지 않아 콘텐츠 스크립트가 받을 수 없다. */
    "refresher:searchPosts"(query: string): string;

    /**
     * 탭 → 배경: 갤로그 첫 화면(HTML). 아이디로 작성자 글을 찾을 때 닉네임을 읽는다 (features/search). gallog.dcinside.com도 CORS를 열지 않는다.
     * 없는 아이디(404)면 null이다.
     */
    "refresher:gallogPage"(id: string): string | null;

    /** 탭 → 배경: 쓰인 차단 항목·메모 (core/usage.ts). 여러 탭이 동시에 써도 기록을 잃지 않게 배경이 차례로 저장한다. */
    "refresher:markUsed"(batch: UsageData): void;

    /** 옵션 → 배경: 사용 기록을 지금 목록에 맞추고 그 종류의 기록을 돌려준다. prune이면 목록에 없는 기록도 버린다 (core/usage.ts의 syncUsage). */
    "refresher:syncUsage"(data: { kind: UsageKind; ids: string[]; prune: boolean }): Record<string, number>;

    /** 배경 → 탭: 이미지 우클릭 메뉴의 "이 이미지 차단". 인자는 이미지 주소다. 탭이 파일 해시를 구해 차단 목록에 넣는다 (stores/blockRequest.ts). */
    "refresher:blockImage"(url: string): void;

    /** 옵션 → 배경: IP·밴 DB "지금 갱신". 같은 버전이어도 다시 받는다. 배경 한 곳에서 받아야 진행 중인 갱신과 겹쳐 두 번 받지 않는다. */
    "refresher:updateDatabase"(): void;

    /** 팝업 → 탭: 이 페이지의 토글 상태와 시작하지 못한 모듈. */
    "refresher:pageState"(): PageState;

    /** 팝업 → 탭: 이 페이지에서만 토글. 바뀐 상태를 돌려준다. */
    "refresher:pageAction"(action: PageAction): PageState;
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
