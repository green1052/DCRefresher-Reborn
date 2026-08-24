import * as block from "@/core/block";
import {User} from "@/utils/user";
import {extractIconFromGallog} from "./commentParse";
import type {PostCache} from "./cache";

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
        v.memo = v.memo.replace(/data-dcconoverstatus="false"/g, 'data-dcconoverstatus="true"');
        v.memo = v.memo.replace(/\s+onmousedown\s*=\s*"[^"]*"/gi, "");
        v.memo = v.memo.replace(/\bwritten_dccon\b/g, "");
        v.memo = v.memo.replace(/\s*style\s*=\s*"[^"]*"/gi, "");
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

    const threadCounts = comments.comments.filter((v) => v.depth === 0).length;
    const commentCounts = comments.comments.length;

    return {comments, threadCounts, commentCounts};
}
