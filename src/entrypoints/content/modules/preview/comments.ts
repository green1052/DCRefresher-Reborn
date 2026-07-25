import eventBus from "@/core/eventbus";
import * as http from "@/http/http";
import * as block from "@/core/block";
import {submitComment} from "@/utils/comment";
import {User} from "@/utils/user";
import {panel} from "./panel";
import {previewRequest} from "./request";
import toast from "@/utils/toast";
import type {PreviewFrame} from "./frame";
import {PostCache} from "./cache";
import type {PostFetchedDataRef} from "./bodyFrame";

// 댓글 날짜 파싱 (연도 없으면 현재 연도 추가)
export function parseCommentDate(str: string): string {
    const hasYear = str.substring(0, 4).match(/\./);
    return hasYear
        ? `${new Date().getFullYear()}-${str.replace(/\./g, "-")}`
        : str.replace(/\./g, "-");
}

// 디시콘 컨텍스트 메뉴 (우클릭 시 디시콘 차단 메뉴)
export function handleDcconContextMenu(e: MouseEvent): void {
    if (!e.target || !(e.target instanceof HTMLElement)) return;
    const element = e.target;

    if (element.classList.contains("written_dccon")) return;

    const src = element.getAttribute("src");
    if (!src) return;

    const code = src.replace(/^.*no=/g, "").replace(/^&.*$/g, "");

    eventBus.emit("refresherUserContextMenu", null, null, null, code, null);
}

// 음성 댓글 데이터 파싱
export interface VoiceData {
    iframe: boolean;
    src: string;
    memo: string;
}

export function parseVoiceData(memo: string): VoiceData | null {
    const parts = memo.split("@^dc^@");
    if (parts.length < 2) return null;

    const hasIframe = parts[0].indexOf("iframe") > -1;

    return {
        iframe: hasIframe,
        src: hasIframe
            ? parts[0].split("src=\"")[1].split("\"")[0]
            : "https://vr.dcinside.com/" + parts[0],
        memo: parts[1]
    };
}

// gallog_icon HTML 파싱 결과 캐싱 (DOMParser 반복 생성 방지)
const gallogIconCache = new Map<string, string | null>();

export const extractIconFromGallog = (gallogIcon: string): string | null => {
    const cached = gallogIconCache.get(gallogIcon);
    if (cached !== undefined) return cached;

    const doc = new DOMParser().parseFromString(gallogIcon, "text/html");
    const src = doc.querySelector("a.writer_nikcon img")?.getAttribute("src") ?? null;

    gallogIconCache.set(gallogIcon, src);
    return src;
};

export interface CommentFilterContext {
    archiveArticle: boolean;
    blurConfig: boolean;
    replyConfig: boolean;
    gallery?: string;
    postCaches: PostCache;
}

// 삭제된 댓글 보존 (archiveArticle 활성 시)
export function restoreDeletedComments(
    comments: DcinsideComments,
    cacheKey: string,
    ctx: CommentFilterContext
): { comments: DcinsideComments; needRefresh: boolean } {
    if (!ctx.archiveArticle) return {comments, needRefresh: false};

    const cache = ctx.postCaches.get(cacheKey);
    const cacheComment = cache?.comment?.comments;

    if (!comments.comments || !cacheComment) return {comments, needRefresh: false};

    const currentCommentMap = new Map(comments.comments.map((c) => [c.no, c]));
    let needRefresh = false;

    for (const cachedComment of cacheComment) {
        const existingComment = currentCommentMap.get(cachedComment.no);

        if (!existingComment) {
            needRefresh = true;
            cachedComment.is_delete = "1";

            if (cachedComment.depth === 1) {
                const parentIndex = comments.comments!.findIndex(
                    (c) => c.no === cachedComment.c_no || c.c_no === cachedComment.c_no
                );

                if (parentIndex !== -1) {
                    comments.comments!.splice(parentIndex + 1, 0, cachedComment);
                } else {
                    comments.comments!.push(cachedComment);
                }
            } else {
                comments.comments!.push(cachedComment);
            }
        } else if (existingComment.is_delete !== "0") {
            const targetIndex = comments.comments!.indexOf(existingComment);
            comments.comments![targetIndex] = cachedComment;
        }
    }

    return {comments, needRefresh};
}

// 댓글이 없을 때 캐시된 댓글로 복원 (archiveArticle 활성 시)
export function restoreFromCacheIfEmpty(
    comments: DcinsideComments,
    cacheKey: string,
    ctx: CommentFilterContext
): { comments: DcinsideComments; threadCounts: number; commentCounts: number; needRefresh: boolean } {
    if (!ctx.archiveArticle || comments.comments) {
        return {comments, threadCounts: 0, commentCounts: 0, needRefresh: false};
    }

    const cache = ctx.postCaches.get(cacheKey);
    const cacheComment = cache?.comment?.comments;

    if (!cacheComment?.length) {
        return {comments, threadCounts: 0, commentCounts: 0, needRefresh: false};
    }

    const restoredComments = cacheComment.map((comment: DcinsideCommentObject) => ({
        ...comment,
        is_delete: "1"
    }));

    comments.comments = restoredComments;
    const threadCounts = restoredComments.filter(
        (comment: DcinsideCommentObject) => comment.depth === 0
    ).length;
    const commentCounts = comments.comments.length;

    return {comments, threadCounts, commentCounts, needRefresh: true};
}

// 댓글 필터링 (차단, 대댓글 처리, User 생성)
export function filterAndProcessComments(
    comments: DcinsideComments,
    ctx: CommentFilterContext
): { comments: DcinsideComments; threadCounts: number; commentCounts: number } {
    if (!comments.comments) return {comments, threadCounts: 0, commentCounts: 0};

    // COMMENT_BOY 필터링
    comments.comments = comments.comments.filter(
        (v: DcinsideCommentObject) => v.nicktype !== "COMMENT_BOY"
    );

    // User 객체 생성
    comments.comments.forEach((v: DcinsideCommentObject) => {
        v.user = new User(
            v.name,
            v.user_id || null,
            v.ip || null,
            extractIconFromGallog(v.gallog_icon)
        );
    });

    // 차단/대댓글 필터링
    let parentComment: DcinsideCommentObject | null = null;

    comments.comments = comments.comments.filter((comment: DcinsideCommentObject) => {
        if (ctx.replyConfig && comment.c_no === parentComment?.no) {
            if (ctx.blurConfig) {
                comment.memo = "댓글 내용이 차단됐습니다.";
                comment.is_delete = "1";
            } else {
                return false;
            }
        }

        const check: {
            [index in RefresherBlockType]?: string;
        } = {
            NICK: comment.name
        };

        if (comment.user_id) {
            check.ID = comment.user_id;
        }

        if (comment.ip) {
            check.IP = comment.ip;
        }

        if (/<(img|video) class=/.test(comment.memo)) {
            const match = /https:\/\/dcimg5\.dcinside\.com\/dccon\.php\?no=(\w*)/g.exec(
                comment.memo
            );
            if (!match) return true;
            check.DCCON = match[1];
        } else {
            check.COMMENT = comment.memo;
        }

        const isBlocked = block.checkAll(check, ctx.gallery);

        if (isBlocked) {
            if (ctx.replyConfig && comment.c_no === 0) {
                parentComment = comment;
            }

            if (ctx.blurConfig) {
                comment.memo = "댓글 내용이 차단됐습니다.";
                comment.is_delete = "1";
            } else {
                return false;
            }
        }

        return true;
    });

    const threadCounts =
        comments.comments.length === 0
            ? 0
            : comments.comments
                .map((v: DcinsideCommentObject) => Number(v.depth === 0))
                .reduce((a: number, b: number) => a + b);
    const commentCounts = comments.comments.length;

    return {comments, threadCounts, commentCounts};
}

// grecaptcha 토큰 획득 (3초 타임아웃)
export function getGrecaptchaToken(): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
        let settled = false;

        const finish = (token?: string) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            window.removeEventListener("message", grecaptchaHandler);
            resolve(token);
        };

        const grecaptchaHandler = (ev: MessageEvent) => {
            if (
                ev.source !== window ||
                !ev.data ||
                ev.data.type !== "refresherGrecaptchaToken"
            ) {
                return;
            }

            finish(typeof ev.data.token === "string" ? ev.data.token : undefined);
        };

        const timeoutId = window.setTimeout(() => finish(), 3000);
        window.addEventListener("message", grecaptchaHandler);

        window.postMessage(
            {
                type: "refresherGrecaptcha",
                action: "comment_token"
            },
            "*"
        );
    });
}

// 댓글 작성 함수 생성
export function createWriteComment(
    preData: GalleryPreData,
    postDom: Document,
    postFetchedDataRef: PostFetchedDataRef,
    signal: AbortSignal
) {
    return async (
        type: "text" | "dccon",
        memo: string | DcinsideDccon[],
        commentNo: string | null,
        replyNo: string | null,
        user: { name: string; pw?: string },
        bigDccon: boolean
    ): Promise<boolean> => {
        if (!postFetchedDataRef.value) {
            toast.show("게시글이 로딩될 때까지 잠시 기다려주세요.", "error");
            return false;
        }

        const requireCapCode = postFetchedDataRef.value.requireCommentCaptcha;
        const codeSrc = requireCapCode ? await previewRequest.captcha(preData, "comment") : undefined;
        const grecaptcha = await getGrecaptchaToken();

        const req = async (captcha?: string) => {
            const postData: GalleryPreData = {
                gallery: postFetchedDataRef.value?.commentId ?? "",
                id: postFetchedDataRef.value?.commentNo ?? "",
                type: ""
            };

            const res = await submitComment(
                postData,
                user,
                postDom,
                memo,
                commentNo,
                replyNo,
                bigDccon,
                captcha,
                grecaptcha
            );

            if (res.result === "false" || res.result === "PreNotWorking") {
                toast.show(res.message!, "error");
                return false;
            }

            return true;
        };

        return codeSrc ? await panel.captcha(codeSrc, req) : req();
    };
}

// RefresherPostCommentIDLoaded 이벤트 대기
export function waitForCommentIdLoaded(signal: AbortSignal): Promise<GalleryPreData | null> {
    return new Promise<GalleryPreData | null>((resolve) => {
        let eventId: (() => void) | null = null;

        const abortHandler = () => {
            if (eventId) {
                eventId();
            }
            resolve(null);
        };

        eventId = eventBus.on(
            "RefresherPostCommentIDLoaded",
            (commentId, commentNo) => {
                signal.removeEventListener("abort", abortHandler);
                resolve({
                    gallery: commentId ?? "",
                    id: commentNo ?? "",
                    type: ""
                });
            },
            {once: true}
        );

        signal.addEventListener("abort", abortHandler, {once: true});
    });
}

// 댓글 삭제 버튼 연속 클릭 방지용 타이머
const deletePressCount: Record<string, number> = {};

// 댓글 삭제 처리
export function handleDeleteComment(
    preData: GalleryPreData,
    commentId: string,
    password: string,
    admin: boolean,
    signal: AbortSignal,
    frame: PreviewFrame
): Promise<boolean> {
    if (!preData.link) return Promise.resolve(false);

    // 비밀번호 없을 시 2회 연속 클릭 체크
    if (!password) {
        if (deletePressCount[commentId] + 1000 < Date.now()) {
            deletePressCount[commentId] = 0;
        }

        if (!deletePressCount[commentId]) {
            toast.show("한번 더 누르면 댓글을 삭제합니다.", "warning", 1000);
            deletePressCount[commentId] = Date.now();
            return Promise.resolve(false);
        }

        deletePressCount[commentId] = 0;
    }

    const typeName = http.galleryTypeName(preData.link);
    if (!typeName.length) return Promise.resolve(false);

    return (
        admin && !password
            ? previewRequest.adminDeleteComment(preData, commentId, signal)
            : previewRequest.userDeleteComment(preData, commentId, signal, password)
    )
        .then((v) => {
            if (typeof v === "boolean") return v;

            if (v.includes("||")) {
                const [result, msg] = v.split("||");
                if (result !== "true") {
                    toast.show(msg, "error");
                    return false;
                }
            } else if (v[0] !== "{") {
                if (v !== "true") {
                    toast.show(v, "error");
                    return false;
                }
                toast.show("댓글을 삭제하였습니다.");
            } else {
                const parsed = JSON.parse(v);
                if (parsed.result !== "fail") {
                    toast.show("댓글을 삭제하였습니다.");
                } else {
                    toast.show(parsed.msg, "error");
                }
            }

            frame.functions.retry();
            return true;
        })
        .catch(() => false);
}