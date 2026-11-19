import {Archive, ArrowUp, CircleAlert, Eye, MessageSquare, RotateCw} from "lucide-react";
import {Fragment, useEffect, useLayoutEffect, useRef, useState} from "react";

import {TooltipButton} from "@/components/WithTooltip";
import {focusedElement} from "@/components/useReturnFocus";
import {BLOCKED_TEXT} from "@/core/block";
import {useContentModuleSettings, useRunningModuleSettings} from "@/core/module/useModuleSettings";
import {postKey as keyOfPost} from "@/core/preview/cache";
import {useUiStore} from "@/stores/ui";
import {smoothScroll} from "@/utils/dom";
import {hasModifier, isTyping} from "@/utils/event";
import {cn} from "cn";

import {adjacentPreData} from "../rows";
import {TimeStamp} from "./TimeStamp";
import {UserCard} from "./UserCard";
import {CommentList, CommentOrder, CommentSummary, threadParents} from "./CommentList";
import {clickContents, markMedia, markPressable, pressContents} from "./contentsClick";
import {CountDown} from "./CountDown";
import {ErrorBlock} from "./ErrorBlock";
import {AdminPanel} from "./Popups";
import {postTitle, usePreviewStore} from "./previewStore";
import {PreviewDialogRoot} from "./PreviewDialogRoot";
import {usePreviewMedia} from "./usePreviewMedia";
import {useScrollLock} from "./useScrollLock";
import {useWheelGesture} from "./useWheelGesture";
import {Votes} from "./Votes";
import {WriteComment} from "./WriteComment";

/** 목록에서 앞(-1)/뒤(1) 글로 넘어간다 - 방향을 넘겨 다음 글을 미리 받게 한다. */
const goToAdjacent = (dir: number): void => {
    const st = usePreviewStore.getState();
    const next = st.preData && adjacentPreData(st.preData, dir);
    if (next) st.requestOpen(next, false, dir);
};

/** 그 방향에 넘어갈 글이 있는지. 목록 처음, 끝 글에서는 스크롤 끝 넘기기를 안내하지 않는다. */
const hasAdjacent = (dir: number): boolean => {
    const {preData} = usePreviewStore.getState();
    return preData !== null && adjacentPreData(preData, dir) !== null;
};

/** run이 끝날 때까지 로딩으로 돌며, 그동안은 다시 누를 수 없다. */
const RefreshButton = ({label, run}: { label: string; run: () => Promise<void> }) => {
    const [busy, setBusy] = useState(false);

    return (
        <TooltipButton tip={label} size="icon-xs" variant="ghost" disabled={busy} onClick={() => {
            setBusy(true);
            void run().finally(() => setBusy(false));
        }}>
            {busy ? <span aria-hidden className="loading loading-spinner"/> : <RotateCw/>}
        </TooltipButton>
    );
};

const Separator = () => <div role="none" className="divider m-0"/>;

/* ui/alert의 모양을 그대로 옮긴 것(ErrorBlock과 같음). */
const ALERT = "alert w-full";

/** 스크롤 끝에서 한 번 더 굴리면 넘어간다는 안내(v5 모양) - 누르거나 굴리는 것은 막지 않는다. */
const SkipHint = ({dir}: { dir: number }) => (
    <div className={cn("refresher-skip-hint pointer-events-none fixed inset-x-0 flex h-[40%] items-center justify-center text-white motion-reduce:animate-none",
                       dir < 0
                           ? "top-0 animate-skip-hint-top bg-linear-to-b from-[rgb(12_23_53/0.7)] via-[rgb(32_42_72/0.3)] to-transparent"
                           : "bottom-0 animate-skip-hint-bottom bg-linear-to-t from-[rgb(12_23_53/0.7)] via-[rgb(32_42_72/0.3)] to-transparent")}>
        <p className={cn("relative text-2xl font-bold tracking-[-1.66px]", dir < 0 ? "-top-[20%]" : "top-[20%]")}>
            한 번 더 스크롤하면 {dir < 0 ? "다음" : "이전"} 게시글로 넘어갑니다.
        </p>
    </div>
);

/** 본문 칸 - 글마다 새로 마운트되므로 HTML이 바뀔 때만 다시 보면 된다. */
const PostContents = () => {
    const post = usePreviewStore((s) => s.post);
    const imageBlocked = usePreviewStore((s) => s.imageBlocked);
    const gallery = usePreviewStore((s) => s.preData?.gallery);
    const {imageViewer} = useContentModuleSettings("preview");
    const revealed = useUiStore((s) => s.blockRevealed);
    const contentsBox = useRef<HTMLDivElement>(null);
    // 숨김 차단된 본문은 안내 문구로 바꾸고, '가린 내용 보기' 동안만 원문을 흐리게 보인다 (features/preview/overlay.css의 data-blocked).
    const hideText = post?.textBlocked === "hide" && !revealed;
    const html = hideText ? BLOCKED_TEXT : post?.contents ?? "";

    // 본문이 새로 들어오면 다시 본다. hideText가 풀려도 동영상, 이미지가 새로 들어온다.
    usePreviewMedia(contentsBox, html, gallery);
    // 이미지 크게 보기와 디시콘 정보 창을 키보드로도 연다 (pressContents).
    useEffect(() => {
        if (contentsBox.current) markPressable(contentsBox.current, imageViewer);
    }, [html, imageViewer]);

    return (
        // 차단 표시는 감싼 상자에 단다. 본문 상자는 다크 모드에서 반전 필터를 쓰므로 흐림 필터와 한 요소에 두면 하나가 덮인다 (Comment.tsx와 같음).
        <div className="grow" data-blocked={hideText ? undefined : post?.textBlocked}>
            <div
                ref={contentsBox}
                className={cn("refresher-html refresher-preview-contents", imageBlocked && "refresher-preview-block-media")}
                onClick={(ev) => clickContents(ev, imageViewer)}
                onKeyDown={pressContents}
                // 이미지가 깨지면 그 이미지의 크게 보기 버튼 표시만 다시 맞춘다. 이미지의 error는 버블링되지 않아 캡처로 받는다.
                onErrorCapture={(ev) => ev.target instanceof HTMLImageElement && markMedia(ev.target, imageViewer)}
                dangerouslySetInnerHTML={{__html: html}}
            />
        </div>
    );
};

export const Frame = () => {
    const visible = usePreviewStore((s) => s.visible);
    const fading = usePreviewStore((s) => s.fading);
    const adminVisible = usePreviewStore((s) => s.adminVisible);
    const post = usePreviewStore((s) => s.post);
    const error = usePreviewStore((s) => s.error);
    const archived = usePreviewStore((s) => s.archived);
    const comments = usePreviewStore((s) => s.comments);
    const commentsFailed = usePreviewStore((s) => s.commentsFailed);
    const allowReply = usePreviewStore((s) => s.allowReply);
    const commentsOnly = usePreviewStore((s) => s.commentsOnly);
    const {previewWidth: frameWidth, toggleBackgroundBlur: backgroundBlur, scrollToSkip} = useContentModuleSettings("preview");
    const block = useRunningModuleSettings("block");
    const revealed = useUiStore((s) => s.blockRevealed);
    const postKey = usePreviewStore((s) => (s.preData ? keyOfPost(s.preData) : ""));
    const listTitle = usePreviewStore((s) => s.preData?.title);
    const scroller = useRef<HTMLDivElement>(null);
    const commentsSection = useRef<HTMLDivElement>(null);
    // 비모달이라 뒤 페이지를 inert로 잠그고, 키보드로 열었을 때만 연 요소로 포커스를 돌려준다.
    useScrollLock(visible);

    // 열거나 글을 바꾸면 스크롤 칸에 포커스를 줘 방향키, 스페이스로 바로 스크롤되게 한다.
    useEffect(() => {
        if (visible) scroller.current?.focus({preventScroll: true});
    }, [visible, postKey]);

    // 글을 바꾸면 맨 위에서 - 캐시 hit이면 앞 글의 스크롤 위치가 남는다. 페이드아웃 중엔 튀지 않게 글 주소로 건다.
    useLayoutEffect(() => {
        if (scroller.current) scroller.current.scrollTop = 0;
    }, [postKey]);

    // 창이 그려진 뒤에 걸면 뜨자마자 누른 PageDown을 놓친다. 그리기 전에 건다.
    useLayoutEffect(() => {
        if (!visible) return;

        const onKey = (ev: KeyboardEvent): void => {
            // Ctrl+PageUp/Down(탭 전환) 같은 조합키는 브라우저에 맡긴다.
            if (hasModifier(ev) || isTyping(ev)) return;
            // 디시콘 정보 창, 크게 보기가 떠 있으면 그 창이 키를 받는다. 옆 글로 넘어가면 창이 닫힌다.
            if (usePreviewStore.getState().dcconInfo || usePreviewStore.getState().viewer) return;
            // 누른 버튼이 로딩으로 막히거나 사라져 포커스가 body로 빠졌으면 스크롤 칸으로 되돌린다 (Tab은 브라우저의 이어가기 위치에 맡긴다).
            if (ev.key !== "Tab" && focusedElement() === document.body) scroller.current?.focus({preventScroll: true});

            // key로 본다. NumLock을 끈 숫자패드 9, 3은 code가 Numpad9, Numpad3이다.
            if (ev.key === "PageUp" || ev.key === "PageDown") {
                ev.preventDefault();
                // 누르고 있을 때의 반복 입력으로는 넘기지 않는다. 지나가는 글마다 본문 요청이 나가 임시 차단된다.
                if (!ev.repeat) goToAdjacent(ev.key === "PageUp" ? -1 : 1);
            }
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [visible]);

    // 끝에 닿은 상태와 안내는 연 창마다 새로 건다. 글 주소로 걸면 닫았다 같은 글을 다시 열 때 앞서 띄운 안내가 그대로 남는다.
    const signalId = usePreviewStore((s) => s.signalId);
    const {onWheel, hint} = useWheelGesture(String(signalId), goToAdjacent, hasAdjacent, scrollToSkip);
    const hintDir = visible && !fading && hint.key === String(signalId) ? hint.dir : 0;

    if (!visible && !fading) return null;

    const busy = !error && !post;
    // 본문이 오면 댓글 칸을 둔다. 댓글을 받는 중이거나 받지 못해도 칸과 새로고침 버튼은 남긴다. 닫는 페이드 동안에는 비운 댓글 칸을 빼낸다.
    const hasComments = comments !== undefined || (post !== undefined && visible);

    return (
        <PreviewDialogRoot
            fading={fading}
            busy={busy}
            blur={backgroundBlur}
            onWheel={onWheel}
            scroller={scroller}
            after={hintDir !== 0 ? <SkipHint dir={hintDir}/> : undefined}
        >
                {/* 너비는 설정을 쓰되 90%까지, 관리 패널 폭을 비운다 - sticky 버튼을 위해 clip이다. */}
                <div
                    className="refresher-frame m-auto flex min-h-[min(800px,90vh)] flex-col overflow-clip rounded-2xl bg-base-100 text-sm shadow-2xl ring-1 ring-base-content/10"
                    data-blur-reveal={block?.blurReveal || undefined}
                    data-block-revealed={revealed || undefined}
                    style={{width: adminVisible ? `min(${frameWidth}px, 90vw, max(480px, calc(100vw - 2 * (150px + 12px))))` : `min(${frameWidth}px, 90vw)`}}
                >
                    {/* 글마다 새로 마운트한다. 안 그러면 캐시 hit일 때 한 번에 렌더돼 쓰던 댓글이 다음 글로 넘어간다. */}
                    <Fragment key={postKey}>
                    <div className="px-8 pt-6 pb-3">
                        {/* 본문을 못 받았으면(삭제된 글 등) 목록의 제목이라도 보인다. */}
                        <h2 className="text-2xl font-bold">{post ? postTitle(post) : listTitle ?? ""}</h2>

                        {post && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                <UserCard user={post.user ?? {}} fetchRatio/>
                                <div className="flex items-center gap-3">
                                    <CountDown/>
                                    {post.date && <TimeStamp date={post.date} size="2"/>}
                                    <span className="flex items-center gap-1 text-sm text-base-content/60">
                                        <Eye className="size-3.5"/>
                                        {post.views}
                                    </span>
                                    <RefreshButton label="새로고침" run={() => usePreviewStore.getState().requestReload()}/>
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator/>

                    {/* 최소 높이로 남는 공간은 본문 글이 채워 추천 버튼이 댓글 바로 위에 붙는다. 비워 두면 댓글 입력칸 아래에 빈 칸이 생긴다. */}
                    <div className="flex grow flex-col px-8 pt-6">
                        {/* 보존본은 삭제되었거나 바뀐 글일 수 있으니 지금 글이 아니라고 알린다. */}
                        {archived && (
                            <div role="alert" className={cn(ALERT, "alert-warning alert-soft mb-4")}>
                                <Archive/>
                                <p data-slot="alert-description">불러오지 못해 저장해 둔 내용을 보여 줍니다.</p>
                            </div>
                        )}
                        {/* 오류를 먼저 본다. 댓글만 보기여도 본문을 못 받았으면 알린다. */}
                        {error ? (
                            <ErrorBlock error={error}/>
                        ) : commentsOnly ? (
                            <button type="button" className="btn mb-6 w-full" onClick={() => usePreviewStore.setState({commentsOnly: false})}>
                                댓글만 표시 중입니다. 눌러서 본문 보기
                            </button>
                        ) : (
                            <>
                                <PostContents/>
                                {post && <Votes post={post}/>}
                            </>
                        )}

                        {busy && (
                            <div className="flex justify-center py-8">
                                <span aria-hidden className="loading loading-spinner size-6"/>
                            </div>
                        )}
                    </div>

                    {hasComments && (
                        <div ref={commentsSection}>
                            <Separator/>
                            <div className="flex items-center justify-between gap-3 px-8 pt-3">
                                {comments && <CommentSummary comments={comments}/>}
                                <div className="flex items-center gap-2">
                                    {comments && threadParents(comments).length > 1 && <CommentOrder/>}
                                    <RefreshButton label="댓글 새로고침" run={() => usePreviewStore.getState().requestRefresh(true)}/>
                                </div>
                            </div>
                            {comments === undefined ? (commentsFailed ? (
                                <div role="alert" className={cn(ALERT, "alert-error alert-soft mx-8 my-4 w-auto")}>
                                    <CircleAlert/>
                                    <div data-slot="alert-description">
                                        댓글을 불러오지 못했습니다.
                                        <div className="mt-2">
                                            {/* 안내가 곧 알림이라 실패를 토스트로 다시 알리지 않는다. */}
                                            <button type="button" className="btn btn-sm btn-error" onClick={() => void usePreviewStore.getState().requestRefresh()}>
                                                다시 시도
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-center py-8">
                                    <span role="status" aria-label="댓글을 불러오는 중" className="loading loading-spinner size-6"/>
                                </div>
                            )) : comments.length === 0 ? (
                                <p className="py-8 text-center text-base-content/60">댓글이 없습니다.</p>
                            ) : (
                                <CommentList comments={comments}/>
                            )}
                        </div>
                    )}

                    {/* 아카이브 글은 서버가 이미 없는 글이므로 댓글을 받지 않는다. */}
                    {post && !archived && (allowReply ? <WriteComment/> : (
                        <p className="px-8 pt-3 pb-6 text-base-content/60">멤버만 댓글을 쓸 수 있습니다.</p>
                    ))}
                    </Fragment>

                    {/* 맨 위로 / 댓글로 - 창 오른쪽 아래. 높이 0인 칸을 화면 아래 끝에 sticky로 붙여 긴 글을 읽는 동안에도 보이게 한다. */}
                    <div className="sticky bottom-0 h-0">
                        <div className="absolute right-4 bottom-4 flex flex-col gap-2">
                            <TooltipButton tip="맨 위로" side="left" variant="secondary" size="icon" className="rounded-full"
                                           onClick={() => scroller.current?.scrollTo({top: 0, behavior: smoothScroll()})}>
                                <ArrowUp/>
                            </TooltipButton>
                            {hasComments && (
                                <TooltipButton tip="댓글로" side="left" variant="secondary" size="icon" className="rounded-full"
                                               onClick={() => commentsSection.current?.scrollIntoView({behavior: smoothScroll(), block: "start"})}>
                                    <MessageSquare/>
                                </TooltipButton>
                            )}
                        </div>
                    </div>
                </div>
                {/* aria-modal 창 안에 두어 스크린 리더가 건너뛰지 않게 한다. */}
                {visible && adminVisible && <AdminPanel/>}
        </PreviewDialogRoot>
    );
};
