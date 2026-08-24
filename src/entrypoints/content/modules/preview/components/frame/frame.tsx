import {useEffect, useRef, useState, useSyncExternalStore} from "react";

import Loader from "@/components/loader";
import PreviewButton from "@/components/previewButton";
import Timestamp from "@/components/timestamp";
import UserComponent from "@/components/user";
import {closeDcconPopup, renderDcconPopup} from "@/entrypoints/content/composables/useDcconPopup";

import Comment from "../comment/comment";
import WriteComment from "../comment/write_comment";
import FrameError from "./frameError";
import FrameVotes from "./frameVotes";

import type {PreviewFrame} from "../../frame";

import "./frame.scss";

interface Props {
    frame: PreviewFrame;
    index: number;
    registerIncrement?: (fn: () => void) => void;
}

export default function Frame({frame, index, registerIncrement}: Props) {
    useSyncExternalStore(frame.subscribe, frame.getSnapshot);

    const [reply, setReply] = useState<{ commentNo: string | null; replyNo: string | null }>({
        commentNo: null,
        replyNo: null
    });
    const [commentKey, setCommentKey] = useState(0);
    const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());

    const [dccon, setDccon] = useState<DcinsideDccon[]>([]);
    const [bigDccon, setBigDccon] = useState(false);
    const dcconRef = useRef(dccon);
    dcconRef.current = dccon;
    const bigDcconRef = useRef(bigDccon);
    bigDcconRef.current = bigDccon;

    const data = frame.data;

    const showLoader =
        !!data.comments &&
        (!data.comments.comments || data.comments.comments.length === 0) &&
        !!data.load;

    const mediaBlockClass =
        data.useImageBlock && data.type === "icon_txt"
            ? "refresher-preview-block-media"
            : "";

    const hasComments = !!data.comments?.comments && data.comments.comments.length > 0;

    const allComments: DcinsideCommentObject[] = data.comments?.comments ?? [];

    // 부모 no -> 답글 수 / 마지막 답글 no (한 번 순회로 계산)
    const replyCountByParent: Record<string, number> = {};
    const lastReplyByParent: Record<string, string> = {};
    for (const c of allComments) {
        if (c.depth === 1 && c.c_no) {
            replyCountByParent[c.c_no] = (replyCountByParent[c.c_no] ?? 0) + 1;
            lastReplyByParent[c.c_no] = c.no;
        }
    }

    const replyCount = (comment: DcinsideCommentObject): number =>
        comment.depth === 0 ? (replyCountByParent[comment.no] ?? 0) : 0;

    const isCollapsed = (comment: DcinsideCommentObject): boolean =>
        comment.depth === 0 && collapsedParents.has(comment.no);

    const isLastReply = (comment: DcinsideCommentObject): boolean =>
        comment.depth === 1 && !!comment.c_no && lastReplyByParent[comment.c_no] === comment.no;

    const toggleCollapse = (no: string) => {
        setCollapsedParents((prev) => {
            const next = new Set(prev);
            if (next.has(no)) next.delete(no);
            else next.add(no);
            return next;
        });
    };

    const visibleComments: DcinsideCommentObject[] = collapsedParents.size === 0
        ? allComments
        : allComments.filter((c) =>
            c.depth === 0 || !collapsedParents.has(c.c_no as string)
        );

    const showVotes = data.comments === undefined && data.buttons;

    const upvote = () => frame.functions.vote(1);
    const downvote = () => frame.functions.vote(0);
    const share = () => frame.functions.share();

    const openOriginal = async (): Promise<boolean> => {
        void frame.functions.openOriginal();
        return true;
    };

    // 댓글 새로고침 (retry 래핑)
    const retry = (): Promise<boolean> => {
        void frame.functions.retry(false);
        return Promise.resolve(true);
    };

    // 댓글 작성 영역으로 포커스 이동
    const toCommentWrite = (): Promise<boolean> => {
        document.querySelector<HTMLElement>("#comment_main")?.focus();
        return Promise.resolve(true);
    };

    // 접힌 상태 펼치기
    const expandCollapse = () => {
        frame.patch({collapse: false});
        void frame.functions.load();
    };

    // 댓글 작성 후 새로고침
    const writeComment = async (
        type: "text" | "dccon",
        memo: string | DcinsideDccon[],
        commentNo: string | null,
        replyNo: string | null,
        user: { name: string; pw?: string },
        selectedBigDccon: boolean
    ): Promise<boolean> => {
        try {
            // 실패(false)를 그대로 돌려줘야 write_comment가 입력 내용을 비우지 않는다
            const ok = await frame.functions.writeComment(type, memo, commentNo, replyNo, user, selectedBigDccon);
            if (ok) void retry();
            return ok;
        } catch {
            return false;
        }
    };

    // 프레임 닫힘 시 상태 초기화
    const resetFrameState = () => {
        frame.reset();
        setReply({commentNo: null, replyNo: null});
        setDccon([]);
        setBigDccon(false);
        closeDcconPopup();
        setCommentKey(0);
        setCollapsedParents(new Set());
    };

    const incrementCommentKey = () => {
        setCommentKey((k) => k + 1);
        setCollapsedParents(new Set());
    };

    useEffect(() => {
        frame.onClose(resetFrameState);
        registerIncrement?.(incrementCommentKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const frameClassName = [
        "refresher-frame",
        frame.options.relative ? "relative" : "",
        frame.options.blur ? "blur" : "",
        frame.options.preview ? "preview" : "",
        frame.options.center ? "center" : ""
    ].filter(Boolean).join(" ");

    return (
        <div className={frameClassName}>
            {frame.error ? (
                <FrameError
                    error={frame.error}
                    retry={retry}
                />
            ) : (
                <div>
                    <div className="refresher-preview-info">
                        <div className="refresher-preview-title-zone">
                            <div className={data.buttons ? "refresher-preview-title-text refresher-title-post" : "refresher-preview-title-text"}>
                                <div
                                    className="refresher-preview-title"
                                    data-index={index + 1}
                                    dangerouslySetInnerHTML={{__html: frame.title}}
                                    key={frame.title}
                                />
                                <span className="refresher-preview-title-mute">{frame.subtitle}</span>
                            </div>

                            {data.comments && (
                                <div className="refresher-comment-controls-container">
                                    {data.useWriteComment && (
                                        <PreviewButton
                                            click={toCommentWrite}
                                            className="refresher-comment-controls"
                                            id="write"
                                        />
                                    )}
                                    <PreviewButton
                                        click={retry}
                                        className="refresher-comment-controls"
                                        id="refresh"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="refresher-preview-meta">
                            {data.user && <UserComponent user={data.user}/>}
                            <div className="float-right">
                                <div className="date-views">
                                    {data.date && <Timestamp date={data.date}/>}
                                    <span className="refresher-views">{data.views}</span>
                                </div>
                                {data.expire && (
                                    <Timestamp
                                        date={data.expire}
                                        mode="remaining"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {frame.collapse ? (
                        <div className="refresher-preview-contents">
                            <div className="refresher-collapse-text">
                                <h3 onClick={expandCollapse}>
                                    댓글 보기를 클릭하여 댓글만 표시합니다. 여기를 눌러 글을 볼 수 있습니다.
                                </h3>
                            </div>
                        </div>
                    ) : (
                        <div className="refresher-preview-contents">
                            {showLoader && <Loader/>}

                            {!data.comments ? (
                                <div
                                    className={`refresher-preview-contents-actual ${mediaBlockClass}`.trim()}
                                    dangerouslySetInnerHTML={{__html: frame.contents ?? ""}}
                                />
                            ) : (
                                <div>
                                    {!hasComments ? (
                                        <div>
                                            <div className="refresher-nocomment-wrap">
                                                <h3>댓글이 없습니다.</h3>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="refresher-preview-comments"
                                            key={commentKey}
                                        >
                                            {visibleComments.map((c, i) => (
                                                <Comment
                                                    collapsed={isCollapsed(c)}
                                                    comment={c}
                                                    delete={frame.functions.deleteComment}
                                                    index={i + 1}
                                                    key={c.no}
                                                    lastReply={c.depth === 1 && isLastReply(c)}
                                                    onUpdateReply={setReply}
                                                    onToggleCollapse={toggleCollapse}
                                                    postUser={data.postUserId}
                                                    reply={reply}
                                                    replyCount={replyCount(c)}
                                                    useWriteComment={data.useWriteComment}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {data.useWriteComment && (
                                        <WriteComment
                                            func={writeComment}
                                            getBigDccon={() => bigDcconRef.current}
                                            getDccon={() => dcconRef.current}
                                            onSetBigDccon={setBigDccon}
                                            onSetDccon={setDccon}
                                            onUpdateReply={setReply}
                                            renderDcconPopup={() =>
                                                renderDcconPopup((selected, big) => {
                                                    setDccon(selected);
                                                    setBigDccon(big);
                                                })
                                            }
                                            reply={reply}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {showVotes && (
                        <FrameVotes
                            disabledDownvote={data.disabledDownvote}
                            downvote={downvote}
                            downvotes={frame.downvotes}
                            fixedUpvotes={frame.fixedUpvotes}
                            original={openOriginal}
                            share={share}
                            upvote={upvote}
                            upvotes={frame.upvotes}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
