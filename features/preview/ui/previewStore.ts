import {create} from "zustand";

import type {ProcessedComment} from "@/core/preview/comments";
import type {GalleryPreData, PostInfo} from "@/core/preview/types";

export interface ErrorState {
    detail: string;
    /** HTTP 상태 코드 — 응답이 왔을 때만 */
    status?: number;
}

export type ManageKind = "notice" | "recommend" | "delete" | "bump";

type Reply = { commentNo: string | null; replyNo: string | null };

type MiniState = { preData: GalleryPreData; x: number; y: number; title: string; contents: string };

/** 게시글을 새로 열 때마다 초기화되는 상태 */
interface PostState {
    title: string;
    subtitle: string;
    contents: string | undefined;
    error: ErrorState | undefined;
    loading: boolean;

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
    loading: false,
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

export const usePreviewStore = create<PreviewState>((set, get) => ({
    ...freshPost(),
    visible: false,
    fading: false,
    preData: null,
    signalId: 0,
    captcha: null,
    mini: null,

    refreshHook: null,
    manageHook: null,
    openHook: null,
    closeHook: null,

    open: (preData) => set({...freshPost(), visible: true, fading: false, loading: true, preData, signalId: ++signalSeq, mini: null}),

    setPost: (post) =>
        set({
            loading: false,
            post,
            title: post.header ? `[${post.header}] ${post.title ?? ""}` : (post.title ?? ""),
            expire: post.expire ? new Date(post.expire) : undefined,
            views: post.views,
            contents: post.contents,
            upvotes: post.upvotes,
            fixedUpvotes: post.fixedUpvotes,
            downvotes: post.disabledDownvote ? undefined : post.downvotes
        }),
    setError: (error) => set({error, loading: false}),
    setComments: (comments, subtitle) => set({comments, subtitle}),
    setVotes: (counts, fixedCounts) => set({upvotes: counts, fixedUpvotes: fixedCounts || undefined}),

    close: () => {
        get().captcha?.resolve("");
        set({visible: false, fading: true, comments: undefined, blockPopup: false, captcha: null, reply: NO_REPLY});
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
