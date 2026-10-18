import {Dialog} from "@base-ui/react/dialog";
import {Archive, ArrowUp, CircleAlert, Eye, MessageSquare, RotateCw} from "lucide-react";
import {Fragment, useEffect, useLayoutEffect, useRef, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {Alert, AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {Spinner} from "@/components/ui/spinner";
import {WithTooltip} from "@/components/WithTooltip";
import {focusedElement} from "@/components/useReturnFocus";
import {BLOCKED_TEXT, similarImageThreshold} from "@/core/block";
import {useContentModuleSettings, useRunningModuleSettings} from "@/core/module/useModuleSettings";
import {postKey as keyOfPost} from "@/core/preview/cache";
import {useBlocksStore} from "@/stores/blocks";
import {useUiStore} from "@/stores/ui";
import {smoothScroll} from "@/utils/dom";
import {isTyping} from "@/utils/event";
import {cn} from "cn";

import {adjacentPreData} from "../rows";
import {TimeStamp} from "./TimeStamp";
import {UserCard} from "./UserCard";
import {CommentList, CommentOrder, CommentSummary, threadParents} from "./CommentList";
import {clickContents, markPressable, pressContents} from "./contentsClick";
import {CountDown} from "./CountDown";
import {ErrorBlock} from "./ErrorBlock";
import {fitMovies} from "./fitMovies";
import {watchGifVideos} from "./gifVideos";
import {markBlockedDccons, markBlockedImages} from "./blockedDccons";
import {AdminPanel} from "./Popups";
import {postTitle, usePreviewStore} from "./previewStore";
import {useWheelGesture} from "./useWheelGesture";
import {Votes} from "./Votes";
import {WriteComment} from "./WriteComment";

/**
 * 목록에서 앞(-1)/뒤(1) 글로 넘어간다. PageUp/Down과 스크롤 끝 넘기기가 같이 쓴다.
 * 방향을 넘겨 컨트롤러가 그 방향 다음 글을 미리 받게 한다.
 */
const goToAdjacent = (dir: number): void => {
    const st = usePreviewStore.getState();
    const next = st.preData && adjacentPreData(st.preData, dir);
    if (next) st.requestOpen(next, false, dir);
};

/** 그 방향에 넘어갈 글이 있는지. 목록 처음·끝 글에서는 스크롤 끝 넘기기를 안내하지 않는다. */
const hasAdjacent = (dir: number): boolean => {
    const {preData} = usePreviewStore.getState();
    return preData !== null && adjacentPreData(preData, dir) !== null;
};

/** run이 끝날 때까지 로딩으로 돌며, 그동안은 다시 누를 수 없다. */
const RefreshButton = ({label, run}: { label: string; run: () => Promise<void> }) => {
    const [busy, setBusy] = useState(false);

    return (
        <WithTooltip tip={label} trigger={<Button size="icon-xs" variant="ghost" aria-label={label} disabled={busy}
                                                  onClick={() => {
                                                      setBusy(true);
                                                      void run().finally(() => setBusy(false));
                                                  }}/>}>
            {busy ? <Spinner aria-hidden/> : <RotateCw/>}
        </WithTooltip>
    );
};

/**
 * 스크롤 끝에서 한 번 더 굴리면 넘어간다는 안내 (v5와 같은 모양). 목록은 번호가 큰 글이 위라 위로 넘기면 다음 글이다.
 * 창 위에 겹치되 누르거나 굴리는 것은 막지 않는다.
 */
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

/**
 * 미리보기 본문 칸. 댓글만 보기·오류일 때는 빠지고 글마다(Frame의 Fragment key) 새로 마운트되며, 창을 닫으면 페이드가 끝난 뒤 빠진다.
 * 그래서 넣은 HTML이 바뀔 때만 다시 보면 되고, 떨어진 영상의 감시·받기는 언마운트 정리가 끊는다.
 */
const PostContents = () => {
    const post = usePreviewStore((s) => s.post);
    const imageBlocked = usePreviewStore((s) => s.imageBlocked);
    const gallery = usePreviewStore((s) => s.preData?.gallery);
    const {imageViewer} = useContentModuleSettings("preview");
    const block = useRunningModuleSettings("block");
    const revealed = useUiStore((s) => s.blockRevealed);
    const blockEntries = useBlocksStore((s) => s.entries);
    const blockDefaults = useBlocksStore((s) => s.defaults);
    const contentsBox = useRef<HTMLDivElement>(null);
    // 숨김 차단된 본문은 안내 문구로 바꾸고, '가린 내용 보기' 동안만 원문을 흐리게 보인다 (features/preview/overlay.css의 data-blocked).
    const hideText = post?.textBlocked === "hide" && !revealed;
    const html = hideText ? BLOCKED_TEXT : post?.contents ?? "";

    // 본문이 새로 들어오면 동영상 크기를 다시 맞춘다. hideText가 풀려도 동영상이 새로 들어온다.
    useEffect(() => (contentsBox.current ? fitMovies(contentsBox.current) : undefined), [html]);
    // 본문에 든 차단 디시콘·이미지는 페이지 글 보기처럼 그것만 가린다. 차단 목록이나 설정이 바뀌면 다시 본다.
    useEffect(() => {
        if (!contentsBox.current) return;
        const mode = block ? (block.blur ? "blur" : "hide") : undefined;
        markBlockedDccons(contentsBox.current, gallery, mode);
        return markBlockedImages(contentsBox.current, gallery, mode, block ? similarImageThreshold(block) : undefined);
    }, [html, block, blockEntries, blockDefaults, gallery]);
    // 깨진 움짤·디시콘 mp4는 디시처럼 gif로 바꾼다.
    useEffect(() => (contentsBox.current ? watchGifVideos(contentsBox.current) : undefined), [html]);
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
                // 이미지가 깨지면 크게 보기 버튼 표시를 다시 맞춘다. 이미지의 error는 버블링되지 않아 캡처로 받는다.
                onErrorCapture={(ev) => ev.target instanceof HTMLImageElement && markPressable(ev.currentTarget, imageViewer)}
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
    // 창은 비모달이라(아래 Dialog.Root) 포커스를 가두지 않는다. 연 동안 뒤 페이지를 inert로 막아 Tab·스크린 리더가 목록으로 나가지 않게 한다.
    // 오버레이(refresher-root: 버블·토스트·관리 패널)와 body에 붙인 확장 UI(data-refresher-ui)는 남긴다.
    // 키보드로 열었을 때(:focus-visible)만 닫으며 연 요소로 포커스를 돌려준다. 마우스로 연 창까지 돌려주면 Esc로 닫을 때
    // 제목 링크에 포커스 링이 생겨 새로고침 모듈이 자동 갱신을 멈춘다. 연 요소는 아래 스크롤 칸 포커스 효과보다 먼저 읽어야 한다.
    useEffect(() => {
        if (!visible) return;

        const focused = focusedElement();
        const opener = focused?.matches(":focus-visible") ? focused : null;
        const html = document.documentElement;
        const previous = {overflow: html.style.overflow, gutter: html.style.scrollbarGutter};
        // 스크롤바가 실제로 있을 때만 그 자리를 남겨, 잠가도 뒤 페이지가 옆으로 밀리지 않게 한다. 짧은 페이지에 걸면 오히려 빈 홈이 생긴다.
        if (window.innerWidth > html.clientWidth) html.style.scrollbarGutter = "stable";
        html.style.overflow = "hidden";
        const blocked = document.body.querySelectorAll<HTMLElement>(":scope > :not(refresher-root, [data-refresher-ui], [inert])");
        for (const element of blocked) element.inert = true;

        return () => {
            html.style.overflow = previous.overflow;
            html.style.scrollbarGutter = previous.gutter;
            for (const element of blocked) element.inert = false;
            opener?.focus({preventScroll: true});
        };
    }, [visible]);

    // 열거나 글을 바꾸면 스크롤 칸에 포커스를 줘 방향키·스페이스로 바로 스크롤되게 한다.
    useEffect(() => {
        if (visible) scroller.current?.focus({preventScroll: true});
    }, [visible, postKey]);

    // 글을 바꾸면 맨 위에서 보인다. 캐시 hit이면 새 글이 한 번에 그려져 앞 글의 스크롤 위치가 남는다.
    // 닫을 때도 오르는 signalId가 아니라 글 주소로 건다. 페이드아웃 중에 맨 위로 튀면 안 된다.
    useLayoutEffect(() => {
        if (scroller.current) scroller.current.scrollTop = 0;
    }, [postKey]);

    // 창 안에서 글자를 끌어 고르다 바깥에서 놓거나 그 반대여도 click은 둘을 감싼 스크롤 칸에 떨어진다. 바깥에서 누르고 뗀 것만 닫는다.
    const pressedOutside = useRef(false);

    // 창이 그려진 뒤에 걸면 뜨자마자 누른 PageDown을 놓친다. 그리기 전에 건다.
    useLayoutEffect(() => {
        if (!visible) return;

        const onKey = (ev: KeyboardEvent): void => {
            // Ctrl+PageUp/Down(탭 전환) 같은 조합키는 브라우저에 맡긴다.
            if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.shiftKey || isTyping(ev)) return;
            // 디시콘 정보 창·크게 보기가 떠 있으면 그 창이 키를 받는다. 옆 글로 넘어가면 창이 닫힌다.
            if (usePreviewStore.getState().dcconInfo || usePreviewStore.getState().viewer) return;
            // 누른 버튼이 로딩으로 막히거나 사라져 포커스가 body로 빠졌으면 스크롤 칸으로 되돌린다 (Tab은 브라우저의 이어가기 위치에 맡긴다).
            if (ev.key !== "Tab" && focusedElement() === document.body) scroller.current?.focus({preventScroll: true});

            if (ev.code === "PageUp" || ev.code === "PageDown") {
                ev.preventDefault();
                // 누르고 있을 때의 반복 입력으로는 넘기지 않는다. 지나가는 글마다 본문 요청이 나가 임시 차단된다(#273).
                if (!ev.repeat) goToAdjacent(ev.code === "PageUp" ? -1 : 1);
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
        // 비모달 창이다. 스크롤 잠금과 PageUp/Down 이동은 직접 처리한다. 바깥 클릭 닫기는 아래 click이 맡는다(위에 뜬 팝업·버블을 눌러도 닫히지 않게).
        <Dialog.Root
            open
            modal={false}
            disablePointerDismissal
            onOpenChange={(open, details) => {
                if (open) return;
                // 닫히는 동안(페이드)과 닫힌 뒤 Preact가 effect 정리를 미룬 사이에도 Base UI가 Esc를 받는다. 이미 닫았으면 키를 흘려보내 목록의 Esc(선택 풀기)가 받게 한다.
                if (!usePreviewStore.getState().visible) {
                    details.cancel();
                    details.allowPropagation();
                    return;
                }
                // Esc는 위에 뜬 것(유저 버블·다이얼로그)부터 닫는다. 그것들은 따로 그려져 Base UI는 미리보기를 맨 위로 본다.
                // 버블은 여기서 닫는다. Base UI는 Esc 리스너를 effect로 거는데 Preact는 effect를 그린 뒤에 돌려, 막 뜬 버블은 아직 Esc를 받지 못한다.
                if (details.reason === "escape-key" && useUiStore.getState().bubble) {
                    details.cancel();
                    useUiStore.getState().closeBubble();
                    return;
                }
                // 다이얼로그는 키를 흘려보내 그쪽이 닫히게 한다.
                if (details.reason === "escape-key" && overlay.portal?.querySelector("[data-slot=dialog-overlay], [data-slot=alert-dialog-overlay], [data-slot=popover-content]")) {
                    details.cancel();
                    details.allowPropagation();
                    return;
                }
                usePreviewStore.getState().requestClose();
            }}
        >
            <Dialog.Portal container={overlay.portal}>
                <div className={cn("fixed inset-0 bg-black/40 duration-150 animate-in fade-in data-fading:pointer-events-none data-fading:animate-out data-fading:fade-out data-fading:fill-mode-forwards",
                                   backgroundBlur && "backdrop-blur-[5px]")}
                     data-fading={fading || undefined}/>
                {/* v5처럼 화면 전체가 스크롤 칸이고 창은 내용만큼 길어진다. 짧은 글은 가운데(margin: auto), 긴 글은 위아래 5vh를 띄운다.
                    스크롤바 폭을 양쪽에 비워야 긴 글과 짧은 글을 오갈 때 창이 옆으로 흔들리지 않는다. 키보드 스크롤용 포커스(tabIndex -1)라 테두리는 그리지 않는다. */}
                <Dialog.Popup
                    className="refresher-frame-scroll fixed inset-0 flex overflow-y-auto overscroll-contain py-[5vh] outline-none duration-150 animate-in fade-in [scrollbar-color:var(--border)_transparent] [scrollbar-gutter:stable_both-edges] [scrollbar-width:thin] data-fading:pointer-events-none data-fading:animate-out data-fading:fade-out data-fading:fill-mode-forwards"
                    ref={scroller}
                    tabIndex={-1}
                    data-fading={fading || undefined}
                    aria-busy={busy}
                    // 비모달이지만 연 동안 뒤 페이지를 inert로 막으므로 보조 기술에는 모달로 알린다.
                    aria-modal
                    // 포커스는 위 효과가 스크롤 칸에 주고, 닫을 때는 연 요소로 직접 돌려준다.
                    initialFocus={false}
                    finalFocus={false}
                    onWheel={onWheel}
                    // 창 바깥을 누르면 닫는다. pointerdown에서 닫으면 칸이 곧바로 사라져 이어지는 click/contextmenu가 아래 목록에 떨어진다
                    // (우클릭으로 닫으면 다른 글 미리보기가 열린다). 그래서 click/contextmenu에서 닫는다.
                    onPointerDown={(ev) => (pressedOutside.current = ev.target === ev.currentTarget)}
                    onPointerUp={(ev) => (pressedOutside.current = pressedOutside.current && ev.target === ev.currentTarget)}
                    onClick={(ev) => {
                        if (pressedOutside.current && ev.target === ev.currentTarget) usePreviewStore.getState().requestClose();
                    }}
                    onContextMenu={(ev) => {
                        if (ev.target !== ev.currentTarget) return;
                        ev.preventDefault();
                        usePreviewStore.getState().requestClose();
                    }}
                >
                {/* 너비는 설정(previewWidth)을 --refresher-frame-width로 받되 둘레에 배경이 보이게 화면의 90%까지만 쓴다.
                    관리 패널(150px)이 있으면 양옆에 그 폭을 비운다 (최소 480px). 둥근 모서리 밖으로 댓글 배경이 나가지 않게 자르는데,
                    hidden이면 스크롤 칸이 되어 맨 위로 버튼(sticky)이 붙지 않으므로 clip이다. */}
                <div
                    className={cn("refresher-frame m-auto flex min-h-[min(800px,90vh)] flex-col overflow-clip rounded-2xl bg-background text-sm shadow-2xl ring-1 ring-foreground/10",
                                  adminVisible
                                      ? "w-[min(var(--refresher-frame-width,1200px),90vw,max(480px,calc(100vw_-_2_*_(150px_+_12px))))]"
                                      : "w-[min(var(--refresher-frame-width,1200px),90vw)]")}
                    data-blur-reveal={block?.blurReveal || undefined}
                    data-block-revealed={revealed || undefined}
                    style={{"--refresher-frame-width": `${frameWidth}px`}}
                >
                    {/* 글마다 새로 마운트한다. 안 그러면 캐시 hit일 때 한 번에 렌더돼 쓰던 댓글이 다음 글로 넘어간다. */}
                    <Fragment key={postKey}>
                    <div className="px-8 pt-6 pb-3">
                        {/* 본문을 못 받았으면(삭제된 글 등) 목록의 제목이라도 보인다. */}
                        <Dialog.Title render={<h2 className="text-2xl font-bold"/>}>{post ? postTitle(post) : listTitle ?? ""}</Dialog.Title>

                        {post && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                <UserCard user={post.user ?? {}} fetchRatio/>
                                <div className="flex items-center gap-3">
                                    <CountDown/>
                                    {post.date && <TimeStamp date={post.date} size="2"/>}
                                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
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
                            <Alert className="mb-4 text-amber-700 dark:text-amber-400">
                                <Archive/>
                                <AlertDescription className="text-current">불러오지 못해 저장해 둔 내용을 보여 줍니다.</AlertDescription>
                            </Alert>
                        )}
                        {/* 오류를 먼저 본다. 댓글만 보기여도 본문을 못 받았으면 알린다. */}
                        {error ? (
                            <ErrorBlock error={error}/>
                        ) : commentsOnly ? (
                            <Button variant="secondary" className="mb-6 w-full" onClick={() => usePreviewStore.setState({commentsOnly: false})}>
                                댓글만 표시 중입니다. 눌러서 본문 보기
                            </Button>
                        ) : (
                            <>
                                <PostContents/>
                                {post && <Votes post={post}/>}
                            </>
                        )}

                        {busy && (
                            <div className="flex justify-center py-8">
                                <Spinner className="size-6"/>
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
                                <Alert variant="destructive" className="mx-8 my-4 w-auto">
                                    <CircleAlert/>
                                    <AlertDescription className="text-current">
                                        댓글을 불러오지 못했습니다.
                                        <div className="mt-2">
                                            {/* 안내가 곧 알림이라 실패를 토스트로 다시 알리지 않는다. */}
                                            <Button size="sm" variant="destructive" onClick={() => void usePreviewStore.getState().requestRefresh()}>
                                                다시 시도
                                            </Button>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="flex justify-center py-8">
                                    <Spinner className="size-6" aria-label="댓글을 불러오는 중"/>
                                </div>
                            )) : comments.length === 0 ? (
                                <p className="py-8 text-center text-muted-foreground">댓글이 없습니다.</p>
                            ) : (
                                <CommentList comments={comments}/>
                            )}
                        </div>
                    )}

                    {post && (allowReply ? <WriteComment/> : (
                        <p className="px-8 pt-3 pb-6 text-muted-foreground">멤버만 댓글을 쓸 수 있습니다.</p>
                    ))}
                    </Fragment>

                    {/* 맨 위로 / 댓글로 — 창 오른쪽 아래. 높이 0인 칸을 화면 아래 끝에 sticky로 붙여 긴 글을 읽는 동안에도 보이게 한다. */}
                    <div className="sticky bottom-0 h-0">
                        <div className="absolute right-4 bottom-4 flex flex-col gap-2">
                            <WithTooltip tip="맨 위로" side="left" trigger={<Button variant="secondary" size="icon" className="rounded-full" aria-label="맨 위로"
                                                                                    onClick={() => scroller.current?.scrollTo({top: 0, behavior: smoothScroll()})}/>}>
                                <ArrowUp/>
                            </WithTooltip>
                            {hasComments && (
                                <WithTooltip tip="댓글로" side="left" trigger={<Button variant="secondary" size="icon" className="rounded-full" aria-label="댓글로"
                                                                                       onClick={() => commentsSection.current?.scrollIntoView({behavior: smoothScroll(), block: "start"})}/>}>
                                    <MessageSquare/>
                                </WithTooltip>
                            )}
                        </div>
                    </div>
                </div>
                {/* 화면 왼쪽에 fixed로 붙인다. 스크롤 칸에 transform이 없어 화면 기준 그대로이고,
                    aria-modal 창 안에 두어야 스크린 리더가 창 밖 내용으로 보고 건너뛰지 않는다. */}
                {visible && adminVisible && <AdminPanel/>}
                </Dialog.Popup>
                {hintDir !== 0 && <SkipHint dir={hintDir}/>}
            </Dialog.Portal>
        </Dialog.Root>
    );
};
