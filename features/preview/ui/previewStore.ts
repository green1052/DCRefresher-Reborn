import {create} from "zustand";

import type {GalleryPreData, IPostInfo} from "@/features/types";
import type {ProcessedComment} from "@/core/preview/comments";

export interface PreviewUser {
    nick?: string;
    id?: string;
    ip?: string;
    Type?: string;
    image?: string;
    memo?: {text: string; color: string};
}

export interface ErrorState {
    title?: string;
    detail: string;
}

export type ManageKind = "notice" | "recommend" | "delete" | "bump";

interface PreviewState {
    /** 프레임 표시 여부 + 페이드 */
    visible: boolean;
    fading: boolean;
    /** 현재 게시글 */
    preData: GalleryPreData | null;
    signalId: number;

    title: string;
    subtitle: string;
    contents: string | undefined;
    error: ErrorState | undefined;
    loading: boolean;

    post: IPostInfo | undefined;
    user: PreviewUser | undefined;
    date: Date | undefined;
    expire: Date | undefined;
    views: string | undefined;

    upvotes: string | undefined;
    fixedUpvotes: string | undefined;
    downvotes: string | undefined;

    comments: ProcessedComment[] | undefined;
    commentTotal: number | undefined;
    collapsed: Set<string>;
    reply: {commentNo: string | null; replyNo: string | null};
    showWrite: boolean;
    /** 댓글만 보기 (reply_num 클릭) */
    commentsOnly: boolean;
    /** 본문 이미지 차단 (blockImage) */
    imageBlocked: boolean;

    notice: boolean;
    recommend: boolean;
    adminVisible: boolean;

    blockPopup: boolean;
    captcha: {url: string; resolve: (code: string) => void} | null;

    mini: {preData: GalleryPreData; x: number; y: number; title: string; contents: string} | null;

    /** controller 연결 (setup에서 주입) */
    openHook: ((preData: GalleryPreData, commentsOnly?: boolean) => void) | null;
    closeHook: (() => void) | null;
    refreshHook: (() => void) | null;
    manageHook: ((kind: ManageKind) => void) | null;

    open: (preData: GalleryPreData) => void;
    setTitle: (title: string) => void;
    setPost: (post: IPostInfo) => void;
    setError: (error: ErrorState) => void;
    setComments: (comments: ProcessedComment[], totalCnt: number, subtitle: string) => void;
    setVotes: (counts: string, fixedCounts: string) => void;
    close: () => void;
    toggleCollapse: (no: string) => void;
    setReply: (reply: {commentNo: string | null; replyNo: string | null}) => void;
    setShowWrite: (show: boolean) => void;
    setCommentsOnly: (only: boolean) => void;
    setImageBlocked: (blocked: boolean) => void;
    setNotice: (notice: boolean) => void;
    setRecommend: (recommend: boolean) => void;
    setAdminVisible: (visible: boolean) => void;
    openBlockPopup: () => void;
    closeBlockPopup: () => void;
    openCaptcha: (url: string) => Promise<string>;
    closeCaptcha: () => void;
    openMini: (data: {preData: GalleryPreData; x: number; y: number; title: string; contents: string}) => void;
    closeMini: () => void;
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

let signalSeq = 0;

export const usePreviewStore = create<PreviewState>((set, get) => ({
    visible: false,
    fading: false,
    preData: null,
    signalId: 0,

    title: "",
    subtitle: "",
    contents: undefined,
    error: undefined,
    loading: false,

    post: undefined,
    user: undefined,
    date: undefined,
    expire: undefined,
    views: undefined,

    upvotes: undefined,
    fixedUpvotes: undefined,
    downvotes: undefined,

    comments: undefined,
    commentTotal: undefined,
    collapsed: new Set(),
    reply: {commentNo: null, replyNo: null},
    showWrite: false,
    commentsOnly: false,
    imageBlocked: false,

    notice: false,
    recommend: false,
    adminVisible: false,

    blockPopup: false,
    captcha: null,

    mini: null,

    refreshHook: null,
    manageHook: null,
    openHook: null,
    closeHook: null,

    open: (preData) =>
        set({
            visible: true,
            fading: false,
            preData,
            signalId: ++signalSeq,
            title: "",
            subtitle: "",
            contents: undefined,
            error: undefined,
            loading: true,
            post: undefined,
            user: undefined,
            date: undefined,
            expire: undefined,
            views: undefined,
            upvotes: undefined,
            fixedUpvotes: undefined,
            downvotes: undefined,
            comments: undefined,
            commentTotal: undefined,
            collapsed: new Set(),
            reply: {commentNo: null, replyNo: null},
            showWrite: false,
            commentsOnly: false,
            imageBlocked: false,
            notice: false,
            recommend: false,
            adminVisible: false,
            blockPopup: false,
            mini: null
        }),

    setTitle: (title) => set({title}),
    setPost: (post) =>
        set({
            loading: false,
            post,
            title: post.header ? `[${post.header}] ${post.title ?? ""}` : (post.title ?? ""),
            user: post.user
                ? {
                    nick: post.user.nick,
                    id: post.user.id,
                    ip: post.user.ip,
                    Type: post.user.Type,
                    image: post.user.image
                }
                : undefined,
            date: post.date ? new Date(post.date) : undefined,
            expire: post.expire ? new Date(post.expire) : undefined,
            views: post.views,
            contents: post.contents,
            upvotes: post.upvotes,
            fixedUpvotes: post.fixedUpvotes,
            downvotes: post.disabledDownvote ? undefined : post.downvotes
        }),
    setError: (error) => set({error, loading: false}),
    setComments: (comments, totalCnt, subtitle) => set({comments, commentTotal: totalCnt, subtitle}),
    setVotes: (counts, fixedCounts) => set({upvotes: counts, fixedUpvotes: fixedCounts || undefined}),

    close: () => {
        const captcha = get().captcha;
        captcha?.resolve("");
        set({visible: false, fading: true, comments: undefined, blockPopup: false, captcha: null, showWrite: false, reply: {commentNo: null, replyNo: null}});
        window.setTimeout(() => set({fading: false}), 200);
    },

    toggleCollapse: (no) =>
        set((state) => {
            const next = new Set(state.collapsed);
            if (next.has(no)) next.delete(no);
            else next.add(no);
            return {collapsed: next};
        }),

    setReply: (reply) => set({reply, showWrite: Boolean(reply.replyNo || reply.commentNo)}),
    setShowWrite: (show) => set({showWrite: show, reply: show ? get().reply : {commentNo: null, replyNo: null}}),
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

    requestOpen: (preData, commentsOnly) => get().openHook?.(preData, commentsOnly),
    requestClose: () => get().closeHook?.(),
    requestRefresh: () => get().refreshHook?.(),
    requestManage: (kind) => get().manageHook?.(kind),
    setHooks: ({open, close, refresh, manage}) =>
        set((state) => ({
            openHook: open ?? state.openHook,
            closeHook: close ?? state.closeHook,
            refreshHook: refresh ?? state.refreshHook,
            manageHook: manage ?? state.manageHook
        }))
}));
