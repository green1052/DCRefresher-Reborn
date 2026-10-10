import {Dialog} from "@base-ui/react/dialog";
import {Archive, ArrowUp, Eye, MessageSquare, RotateCw} from "lucide-react";
import {type CSSProperties, Fragment, useEffect, useLayoutEffect, useRef, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {Alert, AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {Spinner} from "@/components/ui/spinner";
import {WithTooltip} from "@/components/WithTooltip";
import {focusedElement} from "@/components/useReturnFocus";
import {BLOCKED_TEXT} from "@/core/block";
import {useContentModuleSettings, useRunningModuleSettings} from "@/core/module/useModuleSettings";
import {postKey as keyOfPost} from "@/core/preview/cache";
import type {ProcessedComment} from "@/core/preview/comments";
import {useBlocksStore} from "@/stores/blocks";
import {useUiStore} from "@/stores/ui";
import {smoothScroll} from "@/utils/dom";
import {isTyping} from "@/utils/event";
import {cn} from "cn";

import {adjacentPreData} from "../rows";
import {TimeStamp} from "./TimeStamp";
import {UserCard} from "./UserCard";
import {CommentList, threadParents} from "./CommentList";
import {clickContents, markPressable, pressContents} from "./contentsClick";
import {CountDown} from "./CountDown";
import {ErrorBlock} from "./ErrorBlock";
import {fitMovies} from "./fitMovies";
import {watchGifVideos} from "./gifVideos";
import {markBlockedDccons} from "./blockedDccons";
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

/** 댓글 머리의 개수 요약. 차단·접은 수는 0이 아닐 때만 붙인다. */
const subtitleOf = (comments: ProcessedComment[]): string => {
    const blocked = comments.filter((comment) => comment.blocked).length;
    const folded = comments.filter((comment) => comment.duplicates === 0).length;
    const extra = [blocked && `차단 ${blocked}개`, folded && `같은 댓글 ${folded}개 접음`].filter(Boolean).join(", ");
    return `스레드 ${threadParents(comments).length}개, 총 댓글 ${comments.length}개${extra ? ` (${extra})` : ""}`;
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
            {busy ? <Spinner/> : <RotateCw/>}
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

export const Frame = () => {
    const visible = usePreviewStore((s) => s.visible);
    const fading = usePreviewStore((s) => s.fading);
    const adminVisible = usePreviewStore((s) => s.adminVisible);
    const post = usePreviewStore((s) => s.post);
    const contents = post?.contents;
    const error = usePreviewStore((s) => s.error);
    const archived = usePreviewStore((s) => s.archived);
    const comments = usePreviewStore((s) => s.comments);
    const allowReply = usePreviewStore((s) => s.allowReply);
    const commentsOnly = usePreviewStore((s) => s.commentsOnly);
    const imageBlocked = usePreviewStore((s) => s.imageBlocked);
    const {previewWidth: frameWidth, toggleBackgroundBlur: backgroundBlur, scrollToSkip, imageViewer} = useContentModuleSettings("preview");
    const block = useRunningModuleSettings("block");
    const revealed = useUiStore((s) => s.blockRevealed);
    const blockEntries = useBlocksStore((s) => s.entries);
    const blockDefaults = useBlocksStore((s) => s.defaults);
    const gallery = usePreviewStore((s) => s.preData?.gallery);
    const postKey = usePreviewStore((s) => (s.preData ? keyOfPost(s.preData) : ""));
    const listTitle = usePreviewStore((s) => s.preData?.title);
    const scroller = useRef<HTMLDivElement>(null);
    const commentsSection = useRef<HTMLDivElement>(null);
    const contentsBox = useRef<HTMLDivElement>(null);
    // 숨김 차단된 본문은 안내 문구로 바꾸고, '가린 내용 보기' 동안만 원문을 흐리게 보인다 (features/preview/overlay.css의 data-blocked).
    const hideText = post?.textBlocked === "hide" && !revealed;

    // 창이 그려져 있는 동안 (닫는 페이드 포함). 닫을 때 바로 다시 돌지 않고, 페이드가 끝나 본문이 빠지면 정리가 돈다 (떨어진 영상의 감시·받기를 끊는다).
    const mounted = visible || fading;
    // 본문 칸은 댓글만 보기·오류·닫힘일 때 빠졌다가 다시 붙고, 글마다 새로 마운트되므로 그때마다 동영상 크기를 다시 맞춘다.
    // 같은 글을 캐시로 다시 열면 mounted 말고는 값이 모두 같다. hideText가 풀리면 동영상이 새로 들어온다.
    useEffect(() => (contentsBox.current ? fitMovies(contentsBox.current) : undefined), [mounted, contents, commentsOnly, error, postKey, hideText]);
    // 본문에 든 차단 디시콘은 페이지 글 보기처럼 그 디시콘만 가린다. 차단 목록이나 설정이 바뀌면 다시 본다.
    useEffect(() => {
        if (contentsBox.current) markBlockedDccons(contentsBox.current, gallery, block ? (block.blur ? "blur" : "hide") : undefined);
    }, [mounted, contents, commentsOnly, error, postKey, hideText, block, blockEntries, blockDefaults, gallery]);
    // 깨진 움짤·디시콘 mp4는 디시처럼 gif로 바꾼다. 본문 칸이 새로 그려지는 때가 위와 같다.
    useEffect(() => (contentsBox.current ? watchGifVideos(contentsBox.current) : undefined), [mounted, contents, commentsOnly, error, postKey, hideText]);
    // 이미지 크게 보기와 디시콘 정보 창을 키보드로도 연다 (pressContents).
    useEffect(() => {
        if (contentsBox.current) markPressable(contentsBox.current, imageViewer);
    }, [mounted, contents, commentsOnly, error, postKey, hideText, imageViewer]);

    // 창은 비모달이라(아래 Dialog.Root) 포커스를 가두지 않는다. 연 동안 뒤 페이지를 inert로 막아 Tab·스크린 리더가 가려진 목록으로 나가지 않게 한다.
    // 오버레이(refresher-root)는 남긴다. 버블·토스트·관리 패널이 거기 있다. body에 직접 붙인 확장 UI(스텔스 버튼 등)도 data-refresher-ui로 남긴다.
    // 키보드로 열었으면(연 요소에 포커스 링이 보이면) 닫을 때 그 요소(목록의 제목 링크 등)로 포커스를 돌려준다. 글을 넘길 때는 visible이 그대로라 처음 연 요소가 남는다.
    // 마우스로 연 창까지 돌려주면 Esc로 닫을 때 제목 링크에 포커스 링이 생겨 새로고침 모듈이 자동 갱신을 멈춘다.
    // 연 요소는 스크롤 칸에 포커스를 주는 아래 효과보다 먼저 읽어야 해서 이 효과를 앞에 둔다.
    useEffect(() => {
        if (!visible) return;

        const focused = focusedElement();
        const opener = focused?.matches(":focus-visible") ? focused : null;
        const html = document.documentElement;
        const previous = html.style.overflow;
        html.style.overflow = "hidden";
        const blocked = document.body.querySelectorAll<HTMLElement>(":scope > :not(refresher-root, [data-refresher-ui], [inert])");
        for (const element of blocked) element.inert = true;

        return () => {
            html.style.overflow = previous;
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

    useEffect(() => {
        if (!visible) return;

        const onKey = (ev: KeyboardEvent): void => {
            // Ctrl+PageUp/Down(탭 전환) 같은 조합키는 브라우저에 맡긴다.
            if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.shiftKey || isTyping(ev)) return;
            // 디시콘 정보 창·크게 보기가 떠 있으면 그 창이 키를 받는다. 옆 글로 넘어가면 창이 닫힌다.
            if (usePreviewStore.getState().dcconInfo || usePreviewStore.getState().viewer) return;
            // 누른 버튼이 로딩으로 막히거나 사라져 포커스가 body로 빠졌으면 스크롤 칸으로 되돌린다 (Tab은 브라우저의 이어가기 위치에 맡긴다).
            if (ev.key !== "Tab" && focusedElement() === document.body) scroller.current?.focus({preventScroll: true});

            if (ev.code === "PageUp") {
                ev.preventDefault();
                goToAdjacent(-1);
            } else if (ev.code === "PageDown") {
                ev.preventDefault();
                goToAdjacent(1);
            }
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [visible]);

    const {onWheel, hint} = useWheelGesture(postKey, goToAdjacent, scrollToSkip);
    const hintDir = visible && !fading && hint.key === postKey ? hint.dir : 0;

    if (!visible && !fading) return null;

    const busy = !error && !post;

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
                // Esc는 위에 뜬 것(유저 버블·다이얼로그)부터 닫는다. 그것들은 미리보기와 따로 그려져 Base UI가 미리보기를 맨 위로 보므로,
                // 위에 뭔가 떠 있으면 미리보기는 닫지 않는다.
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
                {/* 바깥 배경과 스크롤 칸은 같이 나타나고 같이 사라진다. */}
                <div className={cn("fixed inset-0 bg-black/40 duration-150 animate-in fade-in data-fading:pointer-events-none data-fading:animate-out data-fading:fade-out data-fading:fill-mode-forwards",
                                   backgroundBlur && "backdrop-blur-[5px]")}
                     data-fading={fading || undefined}/>
                {/* v5처럼 화면 전체가 스크롤 칸이고 창은 그 안에서 내용만큼 길어진다. 창 안이든 양옆이든 같은 브라우저 기본 스크롤이다.
                    짧은 글은 창이 가운데 오고(margin: auto), 긴 글은 위아래에 5vh씩 띄운다. 스크롤바 폭을 양쪽에 비워 둔다.
                    안 그러면 긴 글에서만 창이 왼쪽으로 밀려 짧은 글과 오갈 때 옆으로 흔들린다. 키보드 스크롤용 포커스(tabIndex -1)라 테두리는 그리지 않는다. */}
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
                    // &&=는 React Compiler가 지원하지 않아 창 전체가 컴파일되지 않는다.
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
                {/* 너비는 설정(previewWidth)이 --refresher-frame-width로 넘긴다. 작은 창에서도 둘레에 배경이 보이게 화면의 90%까지만.
                    관리 패널(150px)이 있으면 겹치지 않게 양옆에 그 폭만큼 비운다 (너무 좁은 창에선 480px은 유지).
                    짧은 글에서도 납작해 보이지 않게 최소 높이를 둔다. 둥근 모서리 밖으로 댓글 배경이 나가지 않게 자른다.
                    hidden이면 스크롤 칸이 되어 맨 위로 버튼(sticky)이 화면에 붙지 않으므로 clip이다. */}
                <div
                    className={cn("refresher-frame m-auto flex min-h-[min(800px,90vh)] flex-col overflow-clip rounded-2xl bg-background text-sm shadow-2xl ring-1 ring-foreground/10",
                                  adminVisible
                                      ? "w-[min(var(--refresher-frame-width,1200px),90vw,max(480px,calc(100vw_-_2_*_(150px_+_12px))))]"
                                      : "w-[min(var(--refresher-frame-width,1200px),90vw)]")}
                    data-admin={adminVisible || undefined}
                    data-blur-reveal={block?.blurReveal || undefined}
                    data-block-revealed={revealed || undefined}
                    style={{"--refresher-frame-width": `${frameWidth}px`} as CSSProperties}
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
                                <div
                                    ref={contentsBox}
                                    className={cn("refresher-html refresher-preview-contents grow", imageBlocked && "refresher-preview-block-media")}
                                    data-blocked={hideText ? undefined : post?.textBlocked}
                                    onClick={(ev) => clickContents(ev, imageViewer)}
                                    onKeyDown={pressContents}
                                    dangerouslySetInnerHTML={{__html: hideText ? BLOCKED_TEXT : contents ?? ""}}
                                />
                                {post && <Votes post={post}/>}
                            </>
                        )}

                        {busy && (
                            <div className="flex justify-center py-8">
                                <Spinner className="size-6"/>
                            </div>
                        )}
                    </div>

                    {comments !== undefined && (
                        <div ref={commentsSection}>
                            <Separator/>
                            <div className="flex items-center justify-between gap-3 px-8 pt-3">
                                <span className="text-muted-foreground">{subtitleOf(comments)}</span>
                                <RefreshButton label="댓글 새로고침" run={() => usePreviewStore.getState().requestRefresh(true)}/>
                            </div>
                            {comments.length === 0 ? (
                                <p className="py-8 text-center text-muted-foreground">댓글이 없습니다.</p>
                            ) : (
                                <CommentList/>
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
                            {comments !== undefined && (
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
