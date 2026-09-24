import {Fragment, useEffect, useState} from "react";
import {ExternalLink, Eye, ThumbsDown, ThumbsUp} from "lucide-react";
import {Dialog} from "radix-ui";

import {vote, captchaImage} from "@/core/preview/request";
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
            let code: string | undefined;
            if (post.requireCaptcha) {
                code = await usePreviewStore.getState().openCaptcha(captchaImage(preData, "recommend"));
                if (!code) return;
            }

            const result = await vote(preData, post, mode, code);
            if (result.success) {
                usePreviewStore.getState().setVotes(result.counts ?? upvotes ?? "X", result.fixedCounts ?? "");
                useUiStore
                    .getState()
                    .showToast(`${mode === "U" ? "추천" : "비추천"}되었습니다. (총 ${result.counts ?? upvotes ?? "?"}표)`);
            } else {
                useUiStore.getState().showToast("이미 처리했거나 처리에 실패했습니다.", "error");
            }
        } catch {
            useUiStore.getState().showToast("추천 처리 중 오류가 발생했습니다.", "error");
        }
    };

    return (
        <div className="refresher-votes">
            <button type="button" className="up" title="추천" onClick={() => void onVote("U")}>
                <ThumbsUp size={18} />
                {upvotes || "X"}
                {fixedUpvotes ? ` (${fixedUpvotes})` : ""}
            </button>
            {downvotes !== undefined && (
                <button type="button" className="down" title="비추천" onClick={() => void onVote("D")}>
                    <ThumbsDown size={18} />
                    {downvotes}
                </button>
            )}
            <button type="button" title="새 탭으로 열기" onClick={() => window.open(preData?.link ?? location.href, "_blank")}>
                <ExternalLink size={18} />
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

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [visible]);

    if (!visible && !fading) return null;

    const dataLoad = error ? "false" : loading || !post ? "true" : "false";
    const blurBackground = modules.use("preview")?.settings.toggleBackgroundBlur === true;

    // 디시콘/차단/캡챠 팝업이 열려 있으면 프레임 클릭으로 미리보기를 닫지 않는다
    const popupOpen = (): boolean =>
        Boolean(document.querySelector(".refresher-dccon-popup, .refresher-block-popup, .refresher-captcha-popup"));

    return (
        <Dialog.Root
            open
            modal={false}
            onOpenChange={(open) => {
                if (!open) usePreviewStore.getState().requestClose();
            }}
        >
            <Dialog.Portal>
                <div
                    className={"refresher-frame-outer" + (blurBackground ? " blurred" : "") + (fading ? " fading" : "")}
                    onPointerDown={() => {
                        if (popupOpen()) return;
                        usePreviewStore.getState().requestClose();
                    }}
                />
                <Dialog.Content
                    className={"refresher-frame preview" + (fading ? " fading" : "")}
                    data-load={dataLoad}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onPointerDownOutside={(event) => {
                        const target = event.detail.originalEvent.target as Element | null;
                        if (popupOpen() || !target?.closest(".refresher-frame-outer")) event.preventDefault();
                    }}
                    onInteractOutside={(event) => {
                        const target = event.detail.originalEvent.target as Element | null;
                        if (popupOpen() || !target?.closest(".refresher-frame-outer")) event.preventDefault();
                    }}
                >
                    <div className="refresher-preview-title-zone">
                        <div className="refresher-preview-title-text">
                            <Dialog.Title asChild>
                                <h3 className="refresher-preview-title" dangerouslySetInnerHTML={{__html: title}} />
                            </Dialog.Title>
                        </div>
                    </div>

                    {post && (
                        <div className="refresher-preview-meta">
                            <UserCard user={post.user ?? {}} />
                            <div className="float-right">
                                <div className="date-views">
                                    <CountDown />
                                    <div className="refresher-views">
                                        <Eye size={13} />
                                        {views}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="refresher-preview-contents">
                        {commentsOnly ? (
                            <h3 className="refresher-preview-comments-only" onClick={() => usePreviewStore.getState().setCommentsOnly(false)}>
                                댓글만 표시 중입니다. 여기를 눌러 원문을 볼 수 있습니다.
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
                                <Votes />
                            </>
                        )}
                    </div>

                    {comments !== undefined && (
                        <>
                            <div className="refresher-preview-comments-header">{subtitle}</div>
                            {comments.length === 0 ? (
                                <div className="refresher-nocomment-wrap">
                                    <div className="refresher-nocomment">댓글이 없습니다.</div>
                                </div>
                            ) : (
                                <CommentList />
                            )}
                        </>
                    )}

                    {post && <WriteComment />}

                    <div className="refresher-loader" />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
