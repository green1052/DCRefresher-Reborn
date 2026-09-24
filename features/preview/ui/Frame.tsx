import {Fragment, useEffect, useRef, useState} from "react";
import {X} from "lucide-react";

import {vote} from "@/core/preview/request";
import {modules} from "@/core/module/registry";
import {useUiStore} from "@/stores/ui";

import {buildPreData} from "../index";
import {Comment, UserCard} from "./Comment";
import {usePreviewStore, type ErrorState} from "./previewStore";
import {WriteComment} from "./WriteComment";

const CountDown = () => {
    const expire = usePreviewStore((s) => s.expire);
    const [, force] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!document.hidden) force((x) => x + 1);
        }, 30000);
        return () => window.clearInterval(timer);
    }, []);

    if (!expire || Number.isNaN(expire.getTime())) return null;

    const diff = expire.getTime() - Date.now();
    if (diff <= 0) return <span className="refresher-countdown">만료됨</span>;

    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    return (
        <span className="refresher-countdown" title="자동 삭제까지 남은 시간">
            {h > 0 ? `${h}시간 ${m}분` : `${m}분 ${s}초`}
        </span>
    );
};

const Votes = () => {
    const preData = usePreviewStore((s) => s.preData);
    const post = usePreviewStore((s) => s.post);
    const upvotes = usePreviewStore((s) => s.upvotes);
    const fixedUpvotes = usePreviewStore((s) => s.fixedUpvotes);
    const downvotes = usePreviewStore((s) => s.downvotes);

    const onVote = async (mode: "U" | "D"): Promise<void> => {
        if (!preData || !post) return;
        try {
            const result = await vote(preData, post, mode);
            if (result.success) usePreviewStore.getState().setVotes(result.counts ?? upvotes ?? "X", result.fixedCounts ?? "");
        } catch {
            useUiStore.getState().showToast("추천 처리 중 오류가 발생했습니다.", "error");
        }
    };

    return (
        <div className="refresher-votes">
            <button type="button" className="up" onClick={() => void onVote("U")}>
                추천 {upvotes || "X"}
                {fixedUpvotes ? ` (${fixedUpvotes})` : ""}
            </button>
            {downvotes !== undefined && (
                <button type="button" className="down" onClick={() => void onVote("D")}>
                    비추천 {downvotes}
                </button>
            )}
            <button
                type="button"
                onClick={() => {
                    void navigator.clipboard.writeText(location.href);
                    useUiStore.getState().showToast("URL을 복사했습니다.");
                }}
            >
                공유
            </button>
            <button type="button" onClick={() => window.open(preData?.link ?? location.href, "_blank")}>
                새 탭
            </button>
        </div>
    );
};

const ErrorBlock = ({error}: {error: ErrorState}) => {
    const preData = usePreviewStore((s) => s.preData);
    const {detail} = error;

    let text: string;
    if (/fetch/i.test(detail)) text = "서버 또는 브라우저 연결에 실패했습니다.";
    else if (detail.startsWith("4")) text = "게시글이 삭제되었거나 존재하지 않습니다.";
    else if (detail.startsWith("5")) text = "서버가 불안정합니다. 잠시 후 다시 시도해주세요.";
    else text = "게시글 구조를 해석하는데 실패했습니다.";

    return (
        <div className="refresher-error">
            <div className="refresher-error-text">{text}</div>
            <div className="refresher-mute">{detail}</div>
            <button
                type="button"
                onClick={() => {
                    const st = usePreviewStore.getState();
                    if (!preData) return;
                    st.requestClose();
                    st.requestOpen(preData);
                }}
            >
                다시 시도
            </button>
        </div>
    );
};

const CommentList = () => {
    const comments = usePreviewStore((s) => s.comments)!;
    const collapsed = usePreviewStore((s) => s.collapsed);

    const parents = comments.filter((comment) => comment.depth === 0);

    return (
        <div className="refresher-preview-comments">
            {parents.map((parent) => {
                const replies = comments.filter((comment) => comment.depth === 1 && comment.c_no === parent.no);
                const isCollapsed = collapsed.has(parent.no);

                return (
                    <Fragment key={parent.no}>
                        <Comment comment={parent} depth={0} replyCount={replies.length} />
                        {!isCollapsed &&
                            replies.map((child) => <Comment key={child.no} comment={child} depth={1} replyCount={0} />)}
                    </Fragment>
                );
            })}
        </div>
    );
};

export const Frame = () => {
    const visible = usePreviewStore((s) => s.visible);
    const fading = usePreviewStore((s) => s.fading);
    const loading = usePreviewStore((s) => s.loading);
    const post = usePreviewStore((s) => s.post);
    const title = usePreviewStore((s) => s.title);
    const subtitle = usePreviewStore((s) => s.subtitle);
    const contents = usePreviewStore((s) => s.contents);
    const views = usePreviewStore((s) => s.views);
    const error = usePreviewStore((s) => s.error);
    const comments = usePreviewStore((s) => s.comments);
    const commentsOnly = usePreviewStore((s) => s.commentsOnly);
    const imageBlocked = usePreviewStore((s) => s.imageBlocked);

    const [scrollEdge, setScrollEdge] = useState<"top" | "bottom" | null>(null);

    const edge = useRef({count: 0, at: 0});

    useEffect(() => {
        if (!visible) return;

        const html = document.documentElement;
        const previous = html.style.overflow;
        html.style.overflow = "hidden";

        return () => {
            html.style.overflow = previous;
        };
    }, [visible]);

    useEffect(() => {
        if (!visible) return;

        const scrollSkip = modules.use("preview")?.settings.scrollToSkip !== false;

        const goToAdjacent = (dir: number): void => {
            const st = usePreviewStore.getState();
            if (!st.preData) return;

            const rows = Array.from(document.querySelectorAll<HTMLElement>(".gall_list .ub-content")).filter((row) =>
                row.querySelector("a:not(.reply_numbox)")
            );

            const index = rows.findIndex((row) => {
                const pre = buildPreData(row);
                return pre?.id === st.preData?.id && pre?.gallery === st.preData?.gallery;
            });
            if (index < 0) return;

            const next = rows[index + dir];
            const nextPre = next ? buildPreData(next) : null;
            if (nextPre) st.requestOpen(nextPre);
        };

        const onKey = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                usePreviewStore.getState().requestClose();
                return;
            }

            const target = event.target;
            if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
                return;

            if (event.code === "PageUp") {
                event.preventDefault();
                goToAdjacent(-1);
            } else if (event.code === "PageDown") {
                event.preventDefault();
                goToAdjacent(1);
            }
        };

        const onWheel = (event: WheelEvent): void => {
            if (!scrollSkip || Math.abs(event.deltaY) < 2) return;

            const scroller = (event.target as HTMLElement | null)?.closest?.(".refresher-frame");
            if (!scroller) return;

            const dir = event.deltaY > 0 ? 1 : -1;
            const atEdge =
                dir > 0
                    ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
                    : scroller.scrollTop <= 2;

            if (!atEdge) {
                if (edge.current.count !== 0) {
                    edge.current = {count: 0, at: 0};
                    setScrollEdge(null);
                }
                return;
            }

            setScrollEdge(dir > 0 ? "bottom" : "top");

            if (edge.current.count++ < 1) return;
            edge.current.count = 0;

            scroller.scrollTop = 0;
            setScrollEdge(null);
            goToAdjacent(dir);
        };

        window.addEventListener("keydown", onKey);
        window.addEventListener("wheel", onWheel, {passive: true});
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("wheel", onWheel);
            edge.current = {count: 0, at: 0};
            setScrollEdge(null);
        };
    }, [visible]);

    if (!visible && !fading) return null;

    const dataLoad = error ? "false" : loading || !post ? "true" : "false";

    return (
        <div className={"refresher-frame-outer" + (fading ? " fading" : "")}>
            <div
                className="refresher-group"
                onClick={(event) => {
                    if (event.target === event.currentTarget) usePreviewStore.getState().requestClose();
                }}
            >
                <div className="refresher-frame preview" data-load={dataLoad}>
                    <button type="button" className="refresher-preview-close" onClick={() => usePreviewStore.getState().requestClose()}>
                        <X size={16} />
                    </button>

                    <div className="refresher-preview-title-zone">
                        <div className="refresher-preview-title-text">
                            <h3 className="refresher-preview-title" dangerouslySetInnerHTML={{__html: title}} />
                            {subtitle && <div className="refresher-preview-title-mute">{subtitle}</div>}
                        </div>
                        {post && (
                            <div className="refresher-preview-title-controls">
                                <button type="button" onClick={() => document.getElementById("comment_main")?.focus()}>
                                    작성
                                </button>
                                <button type="button" onClick={() => usePreviewStore.getState().requestRefresh()}>
                                    갱신
                                </button>
                            </div>
                        )}
                    </div>

                    {post && (
                        <div className="refresher-preview-meta">
                            <UserCard user={post.user ?? {}} />
                            <div className="float-right">
                                <div className="date-views">
                                    <CountDown />
                                    <div className="refresher-views">{views}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="refresher-preview-contents">
                        {commentsOnly ? (
                            <h3 className="refresher-preview-comments-only" onClick={() => usePreviewStore.getState().setCommentsOnly(false)}>
                                댓글 보기를 클릭하여 댓글만 표시합니다. 여기를 눌러 글을 볼 수 있습니다.
                            </h3>
                        ) : error ? (
                            <ErrorBlock error={error} />
                        ) : (
                            <>
                                <div
                                    className={"refresher-preview-contents-actual" + (imageBlocked ? " refresher-preview-block-media" : "")}
                                    onClick={(event) => {
                                        if ((event.target as HTMLElement).closest(".btn_img_block")) {
                                            event.preventDefault();
                                            usePreviewStore.getState().setImageBlocked(false);
                                        }
                                    }}
                                    dangerouslySetInnerHTML={{__html: contents ?? ""}}
                                />
                                {comments === undefined && <Votes />}
                            </>
                        )}
                    </div>

                    {comments !== undefined &&
                        (comments.length === 0 ? (
                            <div className="refresher-nocomment-wrap">
                                <div className="refresher-nocomment">댓글이 없습니다.</div>
                            </div>
                        ) : (
                            <CommentList />
                        ))}

                    {post && <WriteComment />}

                    <div className="refresher-loader" />
                </div>
            </div>
            {scrollEdge && (
                <div className={"refresher-scroll" + (scrollEdge === "top" ? " top" : "")}>
                    <div className="center">
                        <p>한번 더 스크롤 하면 {scrollEdge === "top" ? "이전" : "다음"} 게시글을 봅니다.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
