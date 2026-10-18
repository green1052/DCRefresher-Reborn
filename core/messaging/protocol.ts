import {defineExtensionMessaging} from "@webext-core/messaging";

import type {UsageData, UsageKind} from "@/core/usage";
import type {Sample} from "@/utils/imageFingerprint";

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

/** 팝업 '현재 페이지'의 상태. failed는 이 페이지에서 setup이 던져 멈춘 모듈 id다 (껐다 켜거나 새로고침할 때까지 다시 시작하지 않는다). */
export interface PageState {
    toggles: PageToggleState[];
    failed: string[];
}

/** 디시 comment.js의 dc_rc_pairs 이름. 글 댓글은 이 쌍의 v3 키로 토큰을 받고, 서버가 같은 쌍의 비밀키로 확인하게 rc_key로 보낸다. */
export type CommentRcKey = "new" | "new3";

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
    "refresher:grecaptchaToken"(data: { action: "comment_submit" | "comment_delete_submit"; rcKey: CommentRcKey } | { action: "insert_icon" }): string | undefined;

    /**
     * 탭 → 배경: refresh·search가 목록 행을 갈아끼우거나 이어 붙였다. 배경이 그 탭의 MAIN world에서 디시 자체 차단·이용자 메모 표시를 다시 적용한다.
     * 인자는 갤러리 id다.
     */
    "refresher:listReplaced"(gallery: string): void;

    /** 탭 → 배경: 글쓰기 모듈이 그 탭의 MAIN world에 이미지 변환(entrypoints/upload-hook.ts)을 넣는다. 페이지마다 한 번. */
    "refresher:hookUploads"(): void;

    /** 탭 → 배경: 디시 통합검색 결과 페이지(HTML). search.dcinside.com은 CORS를 열지 않아 콘텐츠 스크립트가 받을 수 없다. */
    "refresher:searchPosts"(query: string): string;

    /** 탭 → 배경: 갤로그 첫 화면(HTML). 아이디로 작성자 글을 찾을 때 닉네임을 읽는다 (features/search). gallog.dcinside.com도 CORS를 열지 않는다. */
    "refresher:gallogPage"(id: string): string;

    /** 탭 → 배경: 쓰인 차단 항목·메모 (core/usage.ts). 여러 탭이 동시에 써도 기록을 잃지 않게 배경이 차례로 저장한다. */
    "refresher:markUsed"(batch: UsageData): void;

    /** 옵션 → 배경: 사용 기록을 지금 목록에 맞추고 그 종류의 기록을 돌려준다. prune이면 목록에 없는 기록도 버린다 (core/usage.ts의 syncUsage). */
    "refresher:syncUsage"(data: { kind: UsageKind; ids: string[]; prune: boolean }): Record<string, number>;

    /** 배경 → 탭: 이미지 우클릭 메뉴의 "이 이미지 차단". 인자는 이미지 주소다. 탭이 파일 해시를 구해 차단 목록에 넣는다 (stores/blockRequest.ts). */
    "refresher:blockImage"(url: string): void;

    /**
     * 탭 → 배경 (파이어폭스): 페이지가 받은 이미지의 해시. 배경이 페이지의 응답을 흘려보내며 구해 둔다 (features/block/background.ts).
     * 비슷한 이미지 지문은 그 설정이 켜져 있을 때만 구한다. similar가 아니면 지문을 기다리지 않고 파일 해시만 준다.
     * 파이어폭스는 콘텐츠 스크립트의 요청이 페이지의 캐시를 쓰지 않아 직접 받으면 이미지를 한 번 더 받는다. 구해 둔 것이 없으면 undefined다.
     */
    "refresher:imageHash"(data: { url: string; similar: boolean }): ImageHashes | undefined;

    /** 옵션 → 배경: IP·밴 DB "지금 갱신". 같은 버전이어도 다시 받는다. 배경 한 곳에서 받아야 진행 중인 갱신과 겹쳐 두 번 받지 않는다. */
    "refresher:updateDatabase"(): void;

    /** 팝업 → 탭: 이 페이지의 토글 상태와 시작하지 못한 모듈. */
    "refresher:pageState"(): PageState;

    /** 팝업 → 탭: 이 페이지에서만 토글. 바뀐 상태를 돌려준다. */
    "refresher:pageAction"(action: PageAction): PageState;
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
