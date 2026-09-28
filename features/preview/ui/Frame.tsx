import {Box, Button, Callout, Flex, Heading, IconButton, Separator, Spinner, Text, Theme, Tooltip} from "@radix-ui/themes";
import {Archive, ArrowUp, Eye, MessageSquare, RotateCw} from "lucide-react";
import {Dialog} from "radix-ui";
import {type CSSProperties, Fragment, useEffect, useLayoutEffect, useRef, useState, type WheelEvent} from "react";

import {overlay} from "@/components/overlay/shadow";
import {focusedElement} from "@/components/useOpenerFocus";
import {BLOCKED_TEXT} from "@/core/block";
import type {ProcessedComment} from "@/core/preview/comments";
import {useUiStore} from "@/stores/ui";
import {smoothScroll} from "@/utils/dom";
import {isTyping} from "@/utils/event";

import {adjacentPreData} from "../rows";
import {TimeStamp, UserCard} from "./Comment";
import {CommentList} from "./CommentList";
import {CountDown} from "./CountDown";
import {ErrorBlock} from "./ErrorBlock";
import {fitMovies} from "./fitMovies";
import {watchGifVideos} from "./gifVideos";
import {AdminPanel} from "./Popups";
import {postTitle, usePreviewStore} from "./previewStore";
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
    return `스레드 ${comments.filter((comment) => comment.depth === 0).length}개, 총 댓글 ${comments.length}개${extra ? ` (${extra})` : ""}`;
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
        <p>한 번 더 스크롤하면 {dir < 0 ? "다음" : "이전"} 게시글로 넘어갑니다.</p>
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
    // 깨진 움짤·디시콘 mp4는 디시처럼 gif로 바꾼다. 본문 칸이 새로 그려지는 때가 위와 같다
    useEffect(() => (contentsBox.current ? watchGifVideos(contentsBox.current) : undefined), [visible, contents, commentsOnly, error, postKey, hideText]);

    // 창은 비모달이라(아래 Dialog.Root) Radix가 포커스를 가두지 않는다. 연 동안 뒤 페이지를 inert로 막아 Tab·스크린 리더가 가려진 목록으로 나가지 않게 한다.
    // 오버레이(refresher-root)는 남긴다. 버블·토스트·관리 패널이 거기 있다.
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
        const blocked = document.body.querySelectorAll<HTMLElement>(":scope > :not(refresher-root, [inert])");
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
    // 닫을 때도 오르는 signalId가 아니라 글 주소로 건다. 페이드아웃 중에 맨 위로 튀면 안 된다
    useLayoutEffect(() => {
        if (scroller.current) scroller.current.scrollTop = 0;
    }, [postKey]);

    // 창 안에서 글자를 끌어 고르다 바깥에서 놓거나 그 반대여도 click은 둘을 감싼 스크롤 칸에 떨어진다. 바깥에서 누르고 뗀 것만 닫는다
    const pressedOutside = useRef(false);

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
                <div className="refresher-frame-outer" data-fading={fading || undefined} data-blur={backgroundBlur || undefined}/>
                {/* v5처럼 화면 전체가 스크롤 칸이고 창은 그 안에서 내용만큼 길어진다. 창 안이든 양옆이든 같은 브라우저 기본 스크롤이다 */}
                <Dialog.Content
                    className="refresher-frame-scroll"
                    ref={scroller}
                    data-fading={fading || undefined}
                    aria-busy={busy}
                    // 비모달이지만 연 동안 뒤 페이지를 inert로 막으므로 보조 기술에는 모달로 알린다
                    aria-modal
                    onOpenAutoFocus={(ev) => ev.preventDefault()}
                    // 바깥 클릭 닫기는 아래 click이 맡는다. 위에 뜬 팝업·버블을 눌러도 닫히지 않게 막는다.
                    onInteractOutside={(ev) => ev.preventDefault()}
                    onWheel={onWheel}
                    // 창 바깥을 누르면 닫는다. pointerdown에서 닫으면 칸이 곧바로 사라져 이어지는 click/contextmenu가 아래 목록에 떨어진다
                    // (우클릭으로 닫으면 다른 글 미리보기가 열린다). 그래서 click/contextmenu에서 닫는다.
                    onPointerDown={(ev) => (pressedOutside.current = ev.target === ev.currentTarget)}
                    onPointerUp={(ev) => (pressedOutside.current &&= ev.target === ev.currentTarget)}
                    onClick={(ev) => {
                        if (pressedOutside.current && ev.target === ev.currentTarget) usePreviewStore.getState().requestClose();
                    }}
                    onContextMenu={(ev) => {
                        if (ev.target !== ev.currentTarget) return;
                        ev.preventDefault();
                        usePreviewStore.getState().requestClose();
                    }}
                >
                <div
                    className="refresher-frame"
                    data-admin={adminVisible || undefined}
                    data-blur-reveal={blockView?.blurReveal || undefined}
                    data-block-revealed={blockView?.revealed || undefined}
                    // 설정 너비가 기준이고, overlay.scss가 화면 폭·관리 패널에 맞춰 줄인다.
                    style={{"--refresher-frame-width": `${frameWidth}px`} as CSSProperties}
                >
                    {/* 글마다 새로 마운트한다. 안 그러면 캐시 hit일 때 한 번에 렌더돼 쓰던 댓글이 다음 글로 넘어간다 */}
                    <Fragment key={postKey}>
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

                    <Box px="6" pt="5" className="refresher-frame-body">
                        {/* 보존본은 삭제되었거나 바뀐 글일 수 있으니 지금 글이 아니라고 알린다 */}
                        {archived && (
                            <Callout.Root color="orange" size="1" mb="4">
                                <Callout.Icon><Archive size={14}/></Callout.Icon>
                                <Callout.Text>불러오지 못해 저장해 둔 내용을 보여 줍니다.</Callout.Text>
                            </Callout.Root>
                        )}
                        {/* 오류를 먼저 본다. 댓글만 보기여도 본문을 못 받았으면 알린다 */}
                        {error ? (
                            <ErrorBlock error={error}/>
                        ) : commentsOnly ? (
                            <Button variant="soft" color="gray" style={{width: "100%"}} mb="5"
                                    onClick={() => usePreviewStore.setState({commentsOnly: false})}>
                                댓글만 표시 중입니다. 눌러서 본문 보기
                            </Button>
                        ) : (
                            <>
                                <Box
                                    ref={contentsBox}
                                    className={"refresher-html refresher-preview-contents" + (imageBlocked ? " refresher-preview-block-media" : "")}
                                    data-blocked={hideText ? undefined : post?.textBlocked}
                                    onClick={(ev) => {
                                        // 이미지를 누르면 디시처럼 원본 보기를 새 탭으로 연다. 주소는 parser.ts가 옮겨 둔 imgPop 주소이고 디시 주소만 연다
                                        const image = (ev.target as HTMLElement).closest<HTMLImageElement>("img[data-pop]");
                                        if (image && !image.closest("a")) {
                                            const url = URL.parse(image.dataset.pop ?? "");
                                            if (url?.protocol === "https:" && url.hostname.endsWith(".dcinside.com")) window.open(url.href, "_blank", "noopener");
                                            return;
                                        }

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
                    </Fragment>

                    <div className="refresher-frame-jump">
                        <Flex direction="column" gap="2">
                            <Tooltip content="맨 위로" side="left" container={overlay.portal}>
                                <IconButton variant="soft" color="gray" radius="full" aria-label="맨 위로"
                                            onClick={() => scroller.current?.scrollTo({top: 0, behavior: smoothScroll()})}>
                                    <ArrowUp size={16}/>
                                </IconButton>
                            </Tooltip>
                            {comments !== undefined && (
                                <Tooltip content="댓글로" side="left" container={overlay.portal}>
                                    <IconButton variant="soft" color="gray" radius="full" aria-label="댓글로"
                                                onClick={() => commentsSection.current?.scrollIntoView({behavior: smoothScroll(), block: "start"})}>
                                        <MessageSquare size={16}/>
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Flex>
                    </div>
                </div>
                </Dialog.Content>
                {hintDir !== 0 && <SkipHint dir={hintDir}/>}
                {/* 화면 왼쪽에 fixed로 붙인다 */}
                {visible && adminVisible && <AdminPanel/>}
                </Theme>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
