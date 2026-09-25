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

type MiniState = { x: number; y: number; title: string; contents: string };

/** 게시글을 새로 열 때마다 초기화되는 상태 */
interface PostState {
    title: string;
    subtitle: string;
    contents: string | undefined;
    error: ErrorState | undefined;

    post: PostInfo | undefined;
    expire: Date | undefined;
    views: string | undefined;

    upvotes: string | undefined;
    fixedUpvotes: string | undefined;
    downvotes: string | undefined;

    comments: ProcessedComment[] | undefined;
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

interface PreviewState extends PostState {
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

    /** controller 연결 (setup에서 주입) */
    openHook: ((preData: GalleryPreData, commentsOnly?: boolean) => void) | null;
    closeHook: (() => void) | null;
    refreshHook: (() => void) | null;
    manageHook: ((kind: ManageKind) => void) | null;

    open: (preData: GalleryPreData) => void;
    setPost: (post: PostInfo) => void;
    setError: (error: ErrorState) => void;
    setComments: (comments: ProcessedComment[], subtitle: string) => void;
    setVotes: (counts: string, fixedCounts: string) => void;
    close: () => void;
    toggleCollapse: (no: string) => void;
    setReply: (reply: Reply) => void;
    setCommentsOnly: (only: boolean) => void;
    setImageBlocked: (blocked: boolean) => void;
    setNotice: (notice: boolean) => void;
    setRecommend: (recommend: boolean) => void;
    setAdminVisible: (visible: boolean) => void;
    openBlockPopup: () => void;
    closeBlockPopup: () => void;
    openCaptcha: (url: string) => Promise<string>;
    closeCaptcha: () => void;
    openMini: (data: MiniState) => void;
    closeMini: () => void;
    moveMini: (clientX: number, clientY: number) => void;
    requestOpen: (preData: GalleryPreData, commentsOnly?: boolean) => void;
    requestClose: () => void;
    requestRefresh: () => void;
    requestManage: (kind: ManageKind) => void;
    setHooks: (hooks: {
        open?: (preData: GalleryPreData, commentsOnly?: boolean) => void;
        close?: () => void;
        refresh?: () => void;
        manage?: (kind: ManageKind) => void;
    }) => void;
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

const freshPost = (): PostState => ({
    title: "",
    subtitle: "",
    contents: undefined,
    error: undefined,
    post: undefined,
    expire: undefined,
    views: undefined,
    upvotes: undefined,
    fixedUpvotes: undefined,
    downvotes: undefined,
    comments: undefined,
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

/** `[말머리] 제목` — 둘 다 평문이라 텍스트로 렌더링한다 */
export const postTitle = (post: PostInfo): string => (post.header ? `[${post.header}] ${post.title ?? ""}` : (post.title ?? ""));

export const usePreviewStore = create<PreviewState>((set, get) => ({
    ...freshPost(),
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

    refreshHook: null,
    manageHook: null,
    openHook: null,
    closeHook: null,

    open: (preData) => set({...freshPost(), visible: true, fading: false, preData, signalId: ++signalSeq, mini: null}),

    setPost: (post) =>
        set({
            post,
            title: postTitle(post),
            expire: post.expire ? new Date(post.expire) : undefined,
            views: post.views,
            contents: post.contents,
            upvotes: post.upvotes,
            fixedUpvotes: post.fixedUpvotes,
            downvotes: post.downvotes
        }),
    setError: (error) => set({error}),
    setComments: (comments, subtitle) => set({comments, subtitle}),
    setVotes: (counts, fixedCounts) => set({upvotes: counts, fixedUpvotes: fixedCounts || undefined}),

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

    setReply: (reply) => set({reply}),
    setCommentsOnly: (commentsOnly) => set({commentsOnly}),
    setImageBlocked: (imageBlocked) => set({imageBlocked}),
    setNotice: (notice) => set({notice}),
    setRecommend: (recommend) => set({recommend}),
    setAdminVisible: (adminVisible) => set({adminVisible}),
    openBlockPopup: () => set({blockPopup: true}),
    closeBlockPopup: () => set({blockPopup: false}),

    openCaptcha: (url) =>
        new Promise((resolve) => {
            set({captcha: {url, resolve}});
        }),
    closeCaptcha: () => set({captcha: null}),

    openMini: (data) => set({mini: data}),
    closeMini: () => set({mini: null}),
    moveMini: (clientX, clientY) =>
        set((state) =>
            state.mini
                ? {
                      mini: {...state.mini, ...miniPosition(clientX, clientY)}
                  }
                : state
        ),

    requestOpen: (preData, commentsOnly) => get().openHook?.(preData, commentsOnly),
    requestClose: () => get().closeHook?.(),
    requestRefresh: () => get().refreshHook?.(),
    requestManage: (kind) => get().manageHook?.(kind),
    setHooks: ({open, close, refresh, manage}) =>
        set({
            openHook: open ?? null,
            closeHook: close ?? null,
            refreshHook: refresh ?? null,
            manageHook: manage ?? null
        })
}));
