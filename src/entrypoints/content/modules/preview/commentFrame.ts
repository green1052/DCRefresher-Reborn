import type {FrameScrollApi, PreviewFrame} from "./frame";
import type {PostFetchedDataRef} from "./bodyFrame";
import {PostCache} from "./cache";
import {previewRequest} from "./request";
import toast from "@/utils/toast";
import {
    type CommentFilterContext,
    createWriteComment,
    filterAndProcessComments,
    handleDeleteComment,
    restoreDeletedComments,
    restoreFromCacheIfEmpty,
    waitForCommentIdLoaded
} from "./comments";

export interface CommentFrameContext {
    frame: PreviewFrame;
    preData: GalleryPreData;
    signal: AbortSignal;
    experimentalComment: boolean;
    autoRefreshComment: boolean;
    commentRefreshInterval: number;
    disableCache: boolean;
    archiveArticle: boolean;
    blurConfig: boolean;
    replyConfig: boolean;
    gallery?: string;
    postCaches: PostCache;
    postFetchedDataRef: PostFetchedDataRef;
    getFrameApp: () => FrameScrollApi | undefined;
    clearRefreshInterval: () => void;
    setRefreshInterval: (id: number) => void;
}

export function makeCommentFrame(ctx: CommentFrameContext): void {
    const {
        frame,
        preData,
        signal,
        experimentalComment,
        autoRefreshComment,
        commentRefreshInterval,
        disableCache,
        postCaches,
        postFetchedDataRef,
        getFrameApp
    } = ctx;

    frame.data.load = true;
    frame.title = "댓글";
    frame.subtitle = "로딩 중...";
    frame.data.useWriteComment = experimentalComment;

    // RefresherPostCommentIDLoaded 대기 후 writeComment 설정
    waitForCommentIdLoaded(signal).then((postData) => {
        if (!postData || signal.aborted) return;

        const postDom = postFetchedDataRef.value?.dom;
        if (!postDom) return;

        frame.functions.writeComment = createWriteComment(preData, postDom, postFetchedDataRef, signal);

        ctx.clearRefreshInterval();
        ctx.setRefreshInterval(
            window.setInterval(() => {
                if (autoRefreshComment) frame.functions.retry(false);
            }, commentRefreshInterval)
        );
    });

    // 댓글 삭제 핸들러
    frame.functions.deleteComment = (commentId: string, password: string, admin: boolean) =>
        handleDeleteComment(preData, commentId, password, admin, signal, frame);

    // 댓글 로드
    frame.functions.load = async (useCache = true) => {
        frame.data.load = true;
        frame.error = undefined;

        const cacheKey = PostCache.key(preData.gallery, preData.id);
        const filterCtx: CommentFilterContext = {
            archiveArticle: ctx.archiveArticle,
            blurConfig: ctx.blurConfig,
            replyConfig: ctx.replyConfig,
            gallery: ctx.gallery,
            postCaches
        };

        const getCommentInfo = async (): Promise<DcinsideComments> => {
            if (useCache && !disableCache) {
                const cache = postCaches.get(cacheKey);
                if (cache?.comment && postFetchedDataRef.value?.commentCount === cache.comment.total_cnt) {
                    return cache.comment;
                }
            }

            const response = await previewRequest.comments(
                {link: preData.link!, gallery: preData.gallery, id: preData.id},
                signal
            );

            if (!response) throw new Error("Can not fetch comment data.");
            return response;
        };

        try {
            let comments = await getCommentInfo();
            let threadCounts = 0;
            let commentCounts = 0;
            let needRefresh = false;

            if (comments.comments) {
                // 삭제된 댓글 보존
                const restored = restoreDeletedComments(comments, cacheKey, filterCtx);
                comments = restored.comments;
                needRefresh = restored.needRefresh;

                // 캐시 업데이트
                postCaches.set(cacheKey, {date: Date.now(), comment: comments});

                // 필터링 및 User 생성
                const filtered = filterAndProcessComments(comments, filterCtx);
                comments = filtered.comments;
                threadCounts = filtered.threadCounts;
                commentCounts = filtered.commentCounts;
            } else {
                // 댓글 없을 때 캐시에서 복원
                const restored = restoreFromCacheIfEmpty(comments, cacheKey, filterCtx);
                comments = restored.comments;
                threadCounts = restored.threadCounts;
                commentCounts = restored.commentCounts;
                needRefresh = restored.needRefresh;
            }

            frame.subtitle = `${
                (commentCounts !== threadCounts && `쓰레드 ${threadCounts}개, 총 댓글`) || ""
            } ${commentCounts}개`;

            frame.data.comments = comments;

            if (needRefresh) {
                getFrameApp()?.commentFrameRef?.incrementCommentKey?.();
            }
        } catch (e) {
            if (frame.data.comments) {
                toast.show(String(e), "error");
            } else {
                frame.error = {title: "댓글", detail: String(e)};
            }
        } finally {
            frame.data.load = false;
        }
    };

    frame.functions.load();
    frame.functions.retry = (useCache = false) => {
        frame.functions.load(useCache);
    };
}