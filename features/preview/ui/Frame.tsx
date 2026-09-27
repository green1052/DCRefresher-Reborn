import {Box, Button, Flex, Heading, IconButton, Separator, Spinner, Text, Theme, Tooltip} from "@radix-ui/themes";
import {ArrowUp, Eye, MessageSquare, RotateCw} from "lucide-react";
import {Dialog} from "radix-ui";
import {type CSSProperties, useEffect, useRef, useState, type WheelEvent} from "react";

import {overlay} from "@/components/overlay/shadow";
import type {ProcessedComment} from "@/core/preview/comments";
import {useUiStore} from "@/stores/ui";
import {isTyping} from "@/utils/event";

import {adjacentPreData} from "../rows";
import {TimeStamp, UserCard} from "./Comment";
import {CommentList} from "./CommentList";
import {CountDown} from "./CountDown";
import {ErrorBlock} from "./ErrorBlock";
import {fitMovies} from "./fitMovies";
import {AdminPanel} from "./Popups";
import {BLOCKED_TEXT, postTitle, usePreviewStore} from "./previewStore";
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

/** 댓글 머리의 개수 요약. 차단·접은 수는 0이 아닐 때만 붙인다 */
const subtitleOf = (comments: ProcessedComment[]): string => {
    const blocked = comments.filter((comment) => comment.blocked).length;
    const folded = comments.filter((comment) => comment.duplicates === 0).length;
    const extra = [blocked && `차단 ${blocked}개`, folded && `같은 댓글 ${folded}개 접음`].filter(Boolean).join(", ");
    return `쓰레드 ${comments.filter((comment) => comment.depth === 0).length}개, 총 댓글 ${comments.length}개${extra ? ` (${extra})` : ""}`;
};

/** run이 끝날 때까지 로딩으로 돌며, 그동안은 다시 누를 수 없다 */
const RefreshButton = ({label, run}: { label: string; run: () => Promise<void> }) => {
    const [busy, setBusy] = useState(false);

    return (
        <Tooltip content={label} container={overlay.portal}>
            <IconButton size="1" variant="ghost" color="gray" aria-label={label} loading={busy}
                        onClick={() => {
                            setBusy(true);
                            void run().finally(() => setBusy(false));
                        }}>
                <RotateCw size={14}/>
            </IconButton>
        </Tooltip>
    );
};

/** 휠 이벤트 사이가 이보다 벌어지면 새 동작으로 본다(ms). 관성 스크롤은 이보다 촘촘하게 이어진다 */
const WHEEL_GESTURE_GAP = 250;

/** 스크롤 칸이 그 방향(1 아래, -1 위)으로 더 굴러가는지. 아래쪽은 배율에 따른 소수점 오차로 2px 여유를 둔다 */
const canScroll = (el: Element, dir: number): boolean => (dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 2 : el.scrollTop > 0);

/** 스크롤 끝에서 한 번 더 굴리면 넘어간다는 안내 (v5와 같은 모양). 목록은 번호가 큰 글이 위라 위로 넘기면 다음 글이다 */
const SkipHint = ({dir}: { dir: number }) => (
    <div className="refresher-skip-hint" data-side={dir < 0 ? "top" : "bottom"}>
        <p>한번 더 스크롤 하면 {dir < 0 ? "다음" : "이전"} 게시글을 봅니다.</p>
    </div>
);

export const Frame = () => {
    const visible = usePreviewStore((s) => s.visible);
    const fading = usePreviewStore((s) => s.fading);
    const adminVisible = usePreviewStore((s) => s.adminVisible);
    const post = usePreviewStore((s) => s.post);
    const contents = post?.contents;
    const error = usePreviewStore((s) => s.error);
    const comments = usePreviewStore((s) => s.comments);
    const allowReply = usePreviewStore((s) => s.allowReply);
    const commentsOnly = usePreviewStore((s) => s.commentsOnly);
    const imageBlocked = usePreviewStore((s) => s.imageBlocked);
    const frameWidth = usePreviewStore((s) => s.frameWidth);
    const backgroundBlur = usePreviewStore((s) => s.backgroundBlur);
    const scrollToSkip = usePreviewStore((s) => s.scrollToSkip);
    const blockView = useUiStore((s) => s.blockView);
    const postKey = usePreviewStore((s) => (s.preData ? `${s.preData.gallery}/${s.preData.id}` : ""));
    const listTitle = usePreviewStore((s) => s.preData?.title);
    const scroller = useRef<HTMLDivElement>(null);
    const commentsSection = useRef<HTMLDivElement>(null);
    const contentsBox = useRef<HTMLDivElement>(null);
    // 숨김 차단된 본문은 안내 문구로 바꾸고, '가린 내용 보기' 동안만 원문을 흐리게 보인다 (overlay.scss의 data-blocked).
    const hideText = post?.textBlocked === "hide" && !blockView?.revealed;

    // 본문 칸은 댓글만 보기·오류·닫힘일 때 빠졌다가 다시 붙고, 글마다 새로 마운트되므로 그때마다 동영상 크기를 다시 맞춘다.
    // 같은 글을 캐시로 다시 열면 visible 말고는 값이 모두 같다. hideText가 풀리면 동영상이 새로 들어온다.
    useEffect(() => (contentsBox.current ? fitMovies(contentsBox.current) : undefined), [visible, contents, commentsOnly, error, postKey, hideText]);

    // 열거나 글을 바꾸면 스크롤 칸에 포커스를 줘 방향키·스페이스로 바로 스크롤되게 한다.
    useEffect(() => {
        if (visible) scroller.current?.focus({preventScroll: true});
    }, [visible, postKey]);

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

        const onKey = (ev: KeyboardEvent): void => {
            // Ctrl+PageUp/Down(탭 전환) 같은 조합키는 브라우저에 맡긴다.
            if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.shiftKey || isTyping(ev)) return;

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

    // 스크롤 끝에서 새로 한 번 더 굴리면 이전/다음 글로 넘어간다. 끝에 닿은 그 동작으로 넘기면 트랙패드 관성에 글이 연달아 넘어간다.
    // 끝에 닿으면 v5처럼 안내를 띄우고, 넘기거나 닫았다 열면 지운다 (hint.key가 지금 글일 때만 보인다).
    const wheel = useRef({last: 0, armed: 0, key: "", settling: false});
    const [hint, setHint] = useState({dir: 0, key: ""});
    const hintDir = visible && !fading && hint.key === postKey ? hint.dir : 0;

    const skipOnWheel = (dir: number, timeStamp: number, atEdge: boolean): void => {
        const state = wheel.current;
        // 앞 글에서 끝에 닿아 둔 상태는 버린다.
        if (state.key !== postKey) {
            state.key = postKey;
            state.armed = 0;
        }
        const newGesture = timeStamp - state.last > WHEEL_GESTURE_GAP;
        state.last = timeStamp;

        // 넘기게 한 동작(관성 포함)이 새 글에서 이어지면 무시한다. 새 글은 맨 위에서 열려, 위로 넘기면 곧바로 끝에 닿은 것으로 잡힌다.
        if (state.settling) {
            if (!newGesture) return;
            state.settling = false;
        }

        let armed = 0;
        if (atEdge && newGesture && state.armed === dir) {
            state.settling = true;
            goToAdjacent(dir);
        }
        // 끝에 닿은 방향을 기억해 두고 다음 동작을 기다린다.
        else if (atEdge) armed = dir;

        if (armed !== state.armed) setHint({dir: armed, key: postKey});
        state.armed = armed;
    };

    const onWheel = (ev: WheelEvent<HTMLDivElement>): void => {
        if (!scrollToSkip || ev.deltaY === 0 || ev.ctrlKey || ev.shiftKey) return;

        const box = ev.currentTarget;
        const target = ev.target;
        // 포털로 뜬 창(디시콘 등)의 휠도 React 트리를 타고 여기로 오므로, 스크롤 칸 DOM 안에서 난 것만 본다.
        if (!(target instanceof Element) || !box.contains(target)) return;

        const dir = ev.deltaY > 0 ? 1 : -1;
        // 안쪽 스크롤 칸(댓글 입력칸 등)이 아직 굴러가면 그쪽 스크롤이라 끝으로 치지 않는다.
        let inner = false;
        for (let el: Element | null = target; el && el !== box; el = el.parentElement) {
            if (el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY) && canScroll(el, dir)) {
                inner = true;
                break;
            }
        }
        skipOnWheel(dir, ev.timeStamp, !inner && !canScroll(box, dir));
    };

    // 배경(창 양옆)에서 굴려도 창을 스크롤한다. 페이지 스크롤은 잠겨 있어 배경엔 굴릴 것이 없다.
    // 마우스 휠 한 칸(100px 안팎)은 브라우저처럼 부드럽게 옮기되, 잇달아 굴려도 남은 거리를 잃지 않게 목표 위치(aim)에 이어 더한다.
    // 트랙패드의 잘게 나뉜 값은 바로 옮긴다.
    const aim = useRef<{ top: number; key: string } | null>(null);
    const onBackdropWheel = (ev: WheelEvent<HTMLDivElement>): void => {
        const box = scroller.current;
        if (!box || ev.deltaY === 0 || ev.ctrlKey || ev.shiftKey) return;

        const dir = ev.deltaY > 0 ? 1 : -1;
        const atEdge = !canScroll(box, dir);
        const delta = ev.deltaY * (ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? box.clientHeight : 1);

        if (Math.abs(delta) >= 50) {
            const from = aim.current?.key === postKey ? aim.current.top : box.scrollTop;
            const top = Math.min(Math.max(from + delta, 0), box.scrollHeight - box.clientHeight);
            aim.current = {top, key: postKey};
            box.scrollTo({top, behavior: "smooth"});
        } else {
            aim.current = null;
            box.scrollTop += delta;
        }

        if (scrollToSkip) skipOnWheel(dir, ev.timeStamp, atEdge);
    };

    if (!visible && !fading) return null;

    const busy = !error && !post;

    return (
        // Themes Dialog는 항상 modal이라 프리미티브를 쓴다. 스크롤 잠금과 PageUp/Down 이동은 직접 처리한다.
        <Dialog.Root
            open
            modal={false}
            onOpenChange={(open) => {
                if (!open) usePreviewStore.getState().requestClose();
            }}
        >
            <Dialog.Portal container={overlay.portal}>
                {/* 프리미티브 포털은 Theme 밖(#portal)에 그려져 테마 토큰이 없으므로 Theme로 다시 감싼다 */}
                <Theme>
                <div
                    className="refresher-frame-outer"
                    data-fading={fading || undefined}
                    data-blur={backgroundBlur || undefined}
                    // pointerdown에서 닫으면 배경이 곧바로 사라져 이어지는 click/contextmenu가 아래 목록에 떨어진다
                    // (우클릭으로 닫으면 다른 글 미리보기가 열린다). 그래서 배경이 받은 click/contextmenu에서 닫는다.
                    onClick={() => usePreviewStore.getState().requestClose()}
                    onWheel={onBackdropWheel}
                    onContextMenu={(ev) => {
                        ev.preventDefault();
                        usePreviewStore.getState().requestClose();
                    }}
                />
                <Dialog.Content
                    className="refresher-frame"
                    data-fading={fading || undefined}
                    data-admin={adminVisible || undefined}
                    data-blur-reveal={blockView?.blurReveal || undefined}
                    data-block-revealed={blockView?.revealed || undefined}
                    // 설정 너비가 기준이고, overlay.scss가 화면 폭·관리 패널에 맞춰 줄인다.
                    style={{"--refresher-frame-width": `${frameWidth}px`} as CSSProperties}
                    aria-busy={busy}
                    onOpenAutoFocus={(ev) => ev.preventDefault()}
                    // 바깥 클릭 닫기는 배경(frame-outer)이 맡는다. 위에 뜬 팝업·버블을 눌러도 닫히지 않게 막는다.
                    onInteractOutside={(ev) => ev.preventDefault()}
                >
                    {/* 스크롤은 안쪽 칸에서 한다. 바깥이 스크롤되면 스크롤바가 오른쪽 둥근 모서리를 덮는다 */}
                    {/* 글마다 새로 마운트한다. 안 그러면 캐시 hit일 때 한 번에 렌더돼 스크롤 위치와 쓰던 댓글이 다음 글로 넘어간다.
                        signalId는 닫을 때도 올라 페이드아웃 중에 맨 위로 튀므로 key는 글 주소로 건다 */}
                    <div className="refresher-frame-scroll" ref={scroller} key={postKey} tabIndex={-1} onWheel={onWheel}
                         onScrollEnd={() => (aim.current = null)}>
                    <Box px="6" pt="5" pb="3">
                        <Dialog.Title asChild>
                            {/* 본문을 못 받았으면(삭제된 글 등) 목록의 제목이라도 보인다 */}
                            <Heading as="h2" size="6">{post ? postTitle(post) : listTitle ?? ""}</Heading>
                        </Dialog.Title>

                        {post && (
                            <Flex justify="between" align="center" gap="3" mt="3" wrap="wrap">
                                <UserCard user={post.user ?? {}} fetchRatio/>
                                <Flex align="center" gap="3">
                                    <CountDown/>
                                    {post.date && <TimeStamp date={post.date} size="2"/>}
                                    <Text size="2" color="gray">
                                        <Flex as="span" align="center" gap="1">
                                            <Eye size={14}/>
                                            {post.views}
                                        </Flex>
                                    </Text>
                                    <RefreshButton label="새로고침" run={() => usePreviewStore.getState().requestReload()}/>
                                </Flex>
                            </Flex>
                        )}
                    </Box>

                    <Separator size="4"/>

                    <Box px="6" pt="5">
                        {/* 오류를 먼저 본다. 댓글만 보기여도 본문을 못 받았으면 알린다 */}
                        {error ? (
                            <ErrorBlock error={error}/>
                        ) : commentsOnly ? (
                            <Button variant="soft" color="gray" style={{width: "100%"}} mb="5"
                                    onClick={() => usePreviewStore.setState({commentsOnly: false})}>
                                댓글만 표시 중입니다. 눌러서 원문 보기
                            </Button>
                        ) : (
                            <>
                                <Box
                                    ref={contentsBox}
                                    className={"refresher-html refresher-preview-contents" + (imageBlocked ? " refresher-preview-block-media" : "")}
                                    data-blocked={hideText ? undefined : post?.textBlocked}
                                    onClick={(ev) => {
                                        const button = (ev.target as HTMLElement).closest(".btn_img_block");
                                        if (!button) return;

                                        ev.preventDefault();
                                        usePreviewStore.setState({imageBlocked: false});
                                        // 관리자가 가린 이미지는 디시처럼 누른 버튼 옆 것만 드러낸다.
                                        // parser.ts는 가린 이미지의 원본 주소(data-original)를 넣지 않으므로 여기서 넣는다.
                                        for (const media of button.parentElement?.querySelectorAll<HTMLElement>(":scope > [data-block], :scope > .refresher-imgnum > [data-block]") ?? []) {
                                            if (media instanceof HTMLImageElement && media.dataset.original) media.src = media.dataset.original;
                                            media.removeAttribute("data-block");
                                        }
                                        button.remove();
                                    }}
                                    dangerouslySetInnerHTML={{__html: hideText ? BLOCKED_TEXT : contents ?? ""}}
                                />
                                {post && <Votes post={post}/>}
                            </>
                        )}

                        {busy && (
                            <Flex justify="center" py="6">
                                <Spinner size="3"/>
                            </Flex>
                        )}
                    </Box>

                    {comments !== undefined && (
                        <Box ref={commentsSection}>
                            <Separator size="4"/>
                            <Flex px="6" pt="3" justify="between" align="center" gap="3">
                                <Text size="2" color="gray">{subtitleOf(comments)}</Text>
                                <RefreshButton label="댓글 새로고침" run={() => usePreviewStore.getState().requestRefresh(true)}/>
                            </Flex>
                            {comments.length === 0 ? (
                                <Box py="6"><Text as="p" size="2" color="gray" align="center">댓글이 없습니다.</Text></Box>
                            ) : (
                                <CommentList/>
                            )}
                        </Box>
                    )}

                    {post && (allowReply ? <WriteComment/> : (
                        <Box px="6" pt="3" pb="5">
                            <Text size="2" color="gray">멤버만 댓글을 쓸 수 있습니다.</Text>
                        </Box>
                    ))}
                    </div>

                    <Flex direction="column" gap="2" className="refresher-frame-jump">
                        <Tooltip content="맨 위로" side="left" container={overlay.portal}>
                            <IconButton variant="soft" color="gray" radius="full" aria-label="맨 위로"
                                        onClick={() => scroller.current?.scrollTo({top: 0, behavior: "smooth"})}>
                                <ArrowUp size={16}/>
                            </IconButton>
                        </Tooltip>
                        {comments !== undefined && (
                            <Tooltip content="댓글로" side="left" container={overlay.portal}>
                                <IconButton variant="soft" color="gray" radius="full" aria-label="댓글로"
                                            onClick={() => commentsSection.current?.scrollIntoView({behavior: "smooth", block: "start"})}>
                                    <MessageSquare size={16}/>
                                </IconButton>
                            </Tooltip>
                        )}
                    </Flex>
                </Dialog.Content>
                {hintDir !== 0 && <SkipHint dir={hintDir}/>}
                {/* 화면 왼쪽에 fixed로 붙인다. Content 안에 두면 transform 때문에 창 기준으로 배치된다 */}
                {visible && adminVisible && <AdminPanel/>}
                </Theme>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
