import type {FrameScrollApi} from "./frame";
import type {PreviewFrame} from "./previewFrame";
import type {PostFetchedDataRef} from "./bodyFrame";
import * as block from "@/core/block";
import eventBus from "@/core/eventbus";
import {submitComment} from "@/utils/comment";
import * as http from "@/http/http";
import {panel} from "./panel";
import {PostCache} from "./cache";
import {previewRequest} from "./request";
import toast from "@/utils/toast";
import {User} from "@/utils/user";

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
        archiveArticle,
        blurConfig,
        replyConfig,
        gallery,
        postCaches,
        postFetchedDataRef,
        getFrameApp
    } = ctx;

    frame.data.load = true;
    frame.title = "댓글";
    frame.subtitle = "로딩 중...";
    frame.data.useWriteComment = experimentalComment;

    new Promise<GalleryPreData | null>((resolve) => {
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
            {
                once: true
            }
        );

        signal.addEventListener("abort", abortHandler, {once: true});
    }).then((postData) => {
        if (!postData || signal.aborted) return;

        const postDom = postFetchedDataRef.value!.dom!;

        frame.functions.writeComment = async (
            type: "text" | "dccon",
            memo: string | DcinsideDccon[],
            commentNo: string | null,
            replyNo: string | null,
            user: { name: string; pw?: string },
            bigDccon: boolean
        ) => {
            if (!postFetchedDataRef.value) {
                toast.show("게시글이 로딩될 때까지 잠시 기다려주세요.", "error");
                return false;
            }

            const requireCapCode = postFetchedDataRef.value.requireCommentCaptcha;

            const codeSrc = requireCapCode ? await previewRequest.captcha(preData, "comment") : undefined;

            const getGreCaptchaToken = () =>
                new Promise<string | undefined>((resolve) => {
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

            const grecaptcha = await getGreCaptchaToken();

            const req = async (captcha?: string) => {
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
                } else {
                    return true;
                }
            };

            return codeSrc ? await panel.captcha(codeSrc, req) : req();
        };

        ctx.clearRefreshInterval();

        ctx.setRefreshInterval(
            window.setInterval(() => {
                if (autoRefreshComment) frame.functions.retry(false);
            }, commentRefreshInterval)
        );
    });

    const deletePressCount: Record<string, number> = {};

    frame.functions.deleteComment = async (commentId: string, password: string, admin: boolean) => {
        if (!preData.link) return false;

        if (!password) {
            if (deletePressCount[commentId] + 1000 < Date.now()) {
                deletePressCount[commentId] = 0;
            }

            if (!deletePressCount[commentId]) {
                toast.show("한번 더 누르면 댓글을 삭제합니다.", "warning", 1000);

                deletePressCount[commentId] = Date.now();

                return false;
            }

            deletePressCount[commentId] = 0;
        }

        const typeName = http.galleryTypeName(preData.link);
        if (!typeName.length) return false;

        return (
            admin && !password
                ? previewRequest.adminDeleteComment(preData, commentId, signal)
                : previewRequest.userDeleteComment(preData, commentId, signal, password)
        )
            .then((v) => {
                if (typeof v === "boolean") {
                    if (!v) return false;

                    return v;
                }

                if (v.includes("||")) {
                    const parsed = v.split("||");

                    if (parsed[0] !== "true") {
                        toast.show(parsed[1], "error");

                        return false;
                    }
                }

                if (v[0] !== "{") {
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
    };

    frame.functions.load = async (useCache = true) => {
        frame.data.load = true;
        frame.error = undefined;

        const getCommentInfo = async (): Promise<DcinsideComments> => {
            if (useCache && !disableCache) {
                const cache = postCaches.get(PostCache.key(preData.gallery, preData.id));

                if (cache?.comment && postFetchedDataRef.value?.commentCount === cache.comment.total_cnt) {
                    return cache.comment;
                }
            }

            const response = await previewRequest.comments(
                {
                    link: preData.link!,
                    gallery: preData.gallery,
                    id: preData.id
                },
                signal
            );

            if (!response) throw new Error("Can not fetch comment data.");

            return response;
        };

        try {
            const comments = await getCommentInfo();
            let threadCounts = 0;
            let commentCounts = 0;
            let needRefresh = false;

            if (comments.comments) {
                const cache = postCaches.get(PostCache.key(preData.gallery, preData.id));
                const cacheComment = cache?.comment?.comments;

                comments.comments = comments.comments.filter(
                    (v: DcinsideCommentObject) => v.nicktype !== "COMMENT_BOY"
                );

                if (archiveArticle && cacheComment) {
                    const currentCommentMap = new Map(comments.comments!.map((c) => [c.no, c]));

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
                }

                postCaches.set(PostCache.key(preData.gallery, preData.id), {
                    date: Date.now(),
                    comment: comments
                });

                comments.comments.forEach((v: DcinsideCommentObject) => {
                    v.user = new User(
                        v.name,
                        v.user_id || null,
                        v.ip || null,
                        new DOMParser()
                            .parseFromString(v.gallog_icon, "text/html")
                            .querySelector("a.writer_nikcon img")
                            ?.getAttribute("src") || null
                    );
                });

                let parentComment: DcinsideCommentObject | null = null;

                comments.comments = comments.comments.filter((comment: DcinsideCommentObject) => {
                    if (replyConfig && comment.c_no === parentComment?.no) {
                        if (blurConfig) {
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

                    const isBlocked = block.checkAll(check, gallery);

                    if (isBlocked) {
                        if (replyConfig && comment.c_no === 0) {
                            parentComment = comment;
                        }

                        if (blurConfig) {
                            comment.memo = "댓글 내용이 차단됐습니다.";
                            comment.is_delete = "1";
                        } else {
                            return false;
                        }
                    }

                    return true;
                });

                threadCounts =
                    comments.comments.length === 0
                        ? 0
                        : comments.comments
                            .map((v: DcinsideCommentObject) => Number(v.depth === 0))
                            .reduce((a: number, b: number) => a + b);
                commentCounts = comments.comments.length;
            } else if (archiveArticle) {
                const cache = postCaches.get(PostCache.key(preData.gallery, preData.id));
                const cacheComment = cache?.comment?.comments;

                if (cacheComment?.length) {
                    needRefresh = true;

                    const restoredComments = cacheComment.map((comment: DcinsideCommentObject) => ({
                        ...comment,
                        is_delete: "1"
                    }));

                    comments.comments = restoredComments;
                    threadCounts = restoredComments.filter(
                        (comment: DcinsideCommentObject) => comment.depth === 0
                    ).length;
                    commentCounts = comments.comments.length;
                }
            }

            frame.subtitle = `${
                (commentCounts !== threadCounts && `쓰레드 ${threadCounts}개, 총 댓글`) || ""
            } ${commentCounts}개`;

            frame.data.comments = comments;

            if (needRefresh) {
                const frameComponent = getFrameApp()?.commentFrameRef;
                frameComponent?.incrementCommentKey?.();
            }
        } catch (e) {
            if (frame.data.comments) {
                toast.show(String(e), "error");
            } else {
                frame.error = {
                    title: "댓글",
                    detail: String(e)
                };
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