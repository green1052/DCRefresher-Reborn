import {create} from "zustand";

import type {ProcessedComment} from "@/core/preview/comments";
import type {GalleryPreData, PostInfo} from "@/core/preview/types";

export interface ErrorState {
    detail: string;
    /** 상태 코드 — HTTP 오류, 또는 본문이 없어 삭제된 글로 본 경우 404 */
    status?: number;
    /** 성인 인증이 필요한 글 (비로그인·미인증이면 본문 대신 인증 안내가 온다) */
    adult?: boolean;
}

export type ManageKind = "notice" | "recommend" | "delete" | "bump";

type Reply = { commentNo: string | null; replyNo: string | null };

/** blockMedia: 이미지 차단(blockImage) — 전체 미리보기와 같은 클래스로 가린다 */
type MiniState = { x: number; y: number; title: string; contents: string; blockMedia: boolean };

/** 게시글을 새로 열 때마다 초기화되는 상태 */
interface PostState {
    error: ErrorState | undefined;
    post: PostInfo | undefined;

    comments: ProcessedComment[] | undefined;
    /** 댓글·답글 쓰기 허용 — 멤버만 댓글인 갤러리면 댓글 응답이 막는다 */
    allowReply: boolean;
    collapsed: Set<string>;
    reply: Reply;
    /** 댓글만 보기 (reply_num 클릭) */
    commentsOnly: boolean;
    /** 본문 이미지 차단 (blockImage) */
    imageBlocked: boolean;

    notice: boolean;
    recommend: boolean;
    adminVisible: boolean;
    blockPopup: boolean;
}

/** 컨트롤러 연결 — setup에서 setState로 넣고, 정리할 때 NO_HOOKS로 뺀다 */
interface Hooks {
    requestOpen: (preData: GalleryPreData, commentsOnly?: boolean, dir?: number) => void;
    requestClose: () => void;
    requestRefresh: () => void;
    requestManage: (kind: ManageKind) => void;
}

interface PreviewState extends PostState, Hooks {
    /** 프레임 표시 여부 + 페이드 */
    visible: boolean;
    fading: boolean;
    /** 현재 게시글 */
    preData: GalleryPreData | null;
    /** 열 때마다 증가 — 늦게 도착한 이전 글의 응답을 버리는 데 쓴다 */
    signalId: number;
    /** 관리 단축키 (관리 패널 힌트용) — 단축키를 끄면 null */
    shortcutKeys: { delete: string; block: string } | null;
    /** 창 너비(px)·바깥 배경 흐림 (설정) */
    frameWidth: number;
    backgroundBlur: boolean;
    /** 스크롤 끝에서 한 번 더 굴리면 이전/다음 글 (설정) */
    scrollToSkip: boolean;

    captcha: { url: string; resolve: (code: string) => void } | null;
    mini: MiniState | null;

    /** 글 상태는 새로 비우고 patch만 얹어 한 번에 연다 */
    open: (preData: GalleryPreData, patch?: Partial<PostState>) => void;
    close: () => void;
    toggleCollapse: (no: string) => void;
    openCaptcha: (url: string) => Promise<string>;
    moveMini: (clientX: number, clientY: number) => void;
}

/** 본문 차단 안내 (창·미니) */
export const BLOCKED_TEXT = "게시글 내용이 차단됐습니다.";

/** 차단 기간 (시간 → 라벨) — 차단 팝업과 차단 프리셋 설정이 같이 쓴다 */
export const BLOCK_DAYS: Record<string, string> = {"1": "1시간", "6": "6시간", "24": "1일", "168": "7일", "336": "14일", "744": "31일"};

/** 미니 미리보기 크기 (Mini.tsx 렌더링과 화면 밖 방지 계산이 공유) */
export const MINI_WIDTH = 560;
export const MINI_HEIGHT = 420;

/** 커서 우하단에 띄우되 화면 밖으로 나가지 않게 */
export const miniPosition = (clientX: number, clientY: number): { x: number; y: number } => ({
    x: Math.max(0, Math.min(clientX + 16, window.innerWidth - MINI_WIDTH - 20)),
    y: Math.max(0, Math.min(clientY + 16, window.innerHeight - MINI_HEIGHT - 20))
});

const NO_REPLY: Reply = {commentNo: null, replyNo: null};

export const NO_HOOKS: Hooks = {
    requestOpen: () => undefined,
    requestClose: () => undefined,
    requestRefresh: () => undefined,
    requestManage: () => undefined
};

const freshPost = (): PostState => ({
    error: undefined,
    post: undefined,
    comments: undefined,
    allowReply: true,
    collapsed: new Set(),
    reply: NO_REPLY,
    commentsOnly: false,
    imageBlocked: false,
    notice: false,
    recommend: false,
    adminVisible: false,
    blockPopup: false
});

let signalSeq = 0;

const KST = 9 * 3_600_000;

/** 디시 시각("2026.09.26 02:29:40", 올해면 연도 없이 "09.26 02:29:40") — 한국 시간이라 브라우저 시간대로 읽으면 해외에서 어긋난다 */
export const parseDate = (value: string): Date => {
    const missingYear = value.substring(0, 4).includes(".");
    // 빠진 연도도 한국 날짜로 — 시차 때문에 해가 바뀌는 무렵 한 해 어긋나지 않게
    const year = missingYear ? `${new Date(Date.now() + KST).getUTCFullYear()}-` : "";

    return new Date(`${year}${value.replace(/\./g, "-").replace(" ", "T")}+09:00`);
};

/** `[말머리] 제목` — 둘 다 평문이라 텍스트로 렌더링한다 */
export const postTitle = (post: PostInfo): string => (post.header ? `[${post.header}] ${post.title ?? ""}` : (post.title ?? ""));

export const usePreviewStore = create<PreviewState>((set, get) => ({
    ...freshPost(),
    ...NO_HOOKS,
    visible: false,
    fading: false,
    preData: null,
    signalId: 0,
    shortcutKeys: null,
    frameWidth: 1000,
    backgroundBlur: false,
    scrollToSkip: true,
    captcha: null,
    mini: null,

    open: (preData, patch) => {
        // 이전 글의 캡차 창은 닫는다 — 남아 있으면 입력한 코드가 이전 글로 간다
        get().captcha?.resolve("");
        set({...freshPost(), ...patch, visible: true, fading: false, preData, signalId: ++signalSeq, mini: null, captcha: null});
    },

    close: () => {
        get().captcha?.resolve("");
        // signal도 올려, 닫은 뒤 도착한 응답(abort로 난 오류 포함)이 페이드아웃 중인 창에 그려지지 않게
        set({visible: false, fading: true, comments: undefined, blockPopup: false, captcha: null, reply: NO_REPLY, signalId: ++signalSeq});
        window.setTimeout(() => set({fading: false}), 200);
    },

    toggleCollapse: (no) =>
        set((state) => {
            const next = new Set(state.collapsed);
            if (!next.delete(no)) next.add(no);
            return {collapsed: next};
        }),

    openCaptcha: (url) =>
        new Promise((resolve) => {
            set({captcha: {url, resolve}});
        }),

    moveMini: (clientX, clientY) =>
        set((state) =>
            state.mini
                ? {
                      mini: {...state.mini, ...miniPosition(clientX, clientY)}
                  }
                : state
        )
}));
