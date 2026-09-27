import {Badge, Box, Button, Callout, Flex, Heading, IconButton, Separator, Spinner, Text, Theme, Tooltip} from "@radix-ui/themes";
import {ArrowUp, CircleAlert, Clock, ExternalLink, Eye, Link2, MessageSquare, RotateCw, ThumbsDown, ThumbsUp} from "lucide-react";
import {Dialog} from "radix-ui";
import {type CSSProperties, Fragment, useEffect, useRef, useState, type WheelEvent} from "react";

import {overlay} from "@/components/overlay/shadow";
import {getEntry, setEntry} from "@/core/preview/cache";
import {captchaImage, viewUrl, vote} from "@/core/preview/request";
import type {ProcessedComment} from "@/core/preview/comments";
import type {PostInfo} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {isTyping} from "@/utils/event";
import {isGalleryManager} from "@/utils/user";

import {adjacentPreData} from "../rows";
import {Comment, TimeStamp, useTick, UserCard} from "./Comment";
import {AdminPanel} from "./Popups";
import {BLOCKED_TEXT, type ErrorState, parseDate, postTitle, usePreviewStore} from "./previewStore";
import {WriteComment} from "./WriteComment";

/**
 * 디시 동영상 iframe(movie_view 등 같은 출처)은 `$('#movieIcon'+no, parent.document).height(...)`로 자기 크기를 맞춘다.
 * 미리보기는 shadow DOM 안이라 그 선택자에 걸리지 않아 기본 300×150으로 잘리므로, 안쪽 내용을 재서 대신 맞춘다.
 * 다른 출처 iframe은 안을 읽을 수 없어 그대로 둔다.
 */
const fitMovies = (root: HTMLElement): (() => void) => {
    const observers = new Map<HTMLIFrameElement, ResizeObserver>();
    const listeners = new AbortController();

    for (const frame of root.querySelectorAll<HTMLIFrameElement>("iframe")) {
        const fit = (): void => {
            // 프레임당 옵저버는 하나다. 다시 로드되면 떠난 문서를 보던 옵저버를 끊는다.
            observers.get(frame)?.disconnect();

            const doc = frame.contentDocument;
            // movie_view는 .v-container, 그 밖엔 body의 첫 요소를 잰다.
            const container = doc?.querySelector<HTMLElement>(".v-container") ?? doc?.body?.firstElementChild;
            if (!doc || !(container instanceof doc.defaultView!.HTMLElement)) return;

            // 글꼴·배율에 따라 1px만 넘쳐도 안쪽에 스크롤바가 생겨 내용을 가리므로 끈다.
            doc.documentElement.style.overflow = "hidden";

            const observer = new ResizeObserver(() => {
                // 다시 로드되는 중(load 전)엔 떠난 문서의 요소가 0으로 재어져 프레임이 접히므로 무시한다.
                if (frame.contentDocument !== doc) return;
                // 컨테이너 크기만 주면 잘린다. 안쪽 body 여백(양쪽 대칭)을 더하고 소수점은 올린다.
                const {width, height} = container.getBoundingClientRect();
                frame.style.width = `${Math.ceil(width + container.offsetLeft * 2)}px`;
                frame.style.height = `${Math.ceil(height + container.offsetTop * 2)}px`;
            });
            observer.observe(container);
            observers.set(frame, observer);
        };

        if (frame.contentDocument?.readyState === "complete" && frame.contentDocument.URL !== "about:blank") fit();
        // 다시 로드되면(새로고침 등) 안쪽 문서가 바뀌므로 load마다 다시 맞춘다.
        frame.addEventListener("load", fit, {signal: listeners.signal});
    }

    return () => {
        listeners.abort();
        for (const observer of observers.values()) observer.disconnect();
    };
};

const Remaining = ({expire}: { expire: Date }) => {
    // 1시간 미만이면 초까지 보여 주므로 1초마다 다시 그린다.
    useTick(1000);

    const diff = expire.getTime() - Date.now();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    return (
        <Tooltip content="자동 삭제까지 남은 시간" container={overlay.portal}>
            <Badge color="orange" variant="soft">
                <Clock size={12}/>
                {diff <= 0 ? "만료됨" : h > 0 ? `${h}시간 ${m}분` : `${m}분 ${s}초`}
            </Badge>
        </Tooltip>
    );
};

// 만료 시각이 있는 글에서만 Remaining을 그린다. 대부분의 글엔 없으니 1초 타이머를 돌리지 않는다.
const CountDown = () => {
    const expire = usePreviewStore((s) => s.post?.expire);
    const date = expire ? parseDate(expire) : undefined;
    return date && !Number.isNaN(date.getTime()) ? <Remaining expire={date}/> : null;
};

const Votes = ({post}: { post: PostInfo }) => {
    const preData = usePreviewStore((s) => s.preData);
    const {upvotes, fixedUpvotes, downvotes} = post;
    // 보내는 중인 쪽. 연타로 추천 POST가 두 번 가지 않게 막는다.
    const [voting, setVoting] = useState<"U" | "D" | null>(null);

    const onVote = async (mode: "U" | "D"): Promise<void> => {
        if (!preData || voting) return;
        const signal = usePreviewStore.getState().signalId;
        setVoting(mode);
        try {
            let code: string | undefined;
            if (post.requireCaptcha) {
                code = await usePreviewStore.getState().openCaptcha(captchaImage(preData, "recommend"));
                if (!code) return;
            }

            const result = await vote(preData, post, mode, code);
            if (result.success) {
                const counts = mode === "U"
                    ? {upvotes: result.counts ?? upvotes ?? "X", fixedUpvotes: result.fixedCounts || undefined}
                    : {downvotes: result.counts ?? downvotes};
                // 응답 전에 다른 글로 넘어갔으면 숫자는 고치지 않고 알림만 띄운다.
                // 함수형 setState로 지금 post를 읽어야 동시에 끝난 추천·비추천이 서로 덮지 않는다.
                usePreviewStore.setState((s) => (s.signalId !== signal || !s.post ? {} : {post: {...s.post, ...counts}}));
                // 1분 안에 다시 열면 캐시 본문을 쓰므로 거기 숫자도 고친다.
                const cached = getEntry(preData)?.post;
                if (cached) setEntry(preData, {post: {...cached, ...counts}});
                useUiStore
                    .getState()
                    .showToast(`${mode === "U" ? "추천" : "비추천"}되었습니다.`);
            } else {
                useUiStore.getState().showToast(result.message ?? "처리하지 못했습니다.", "error");
            }
        } catch {
            useUiStore.getState().showToast("추천 처리 중 오류가 발생했습니다.", "error");
        } finally {
            setVoting(null);
        }
    };

    // 목록 쿼리(검색어·페이지)를 뺀 글 주소를 복사한다.
    const onShare = (): void => {
        if (!preData) return;
        navigator.clipboard.writeText(viewUrl(preData.link, preData.gallery, preData.id)).then(
            () => useUiStore.getState().showToast("링크를 복사했습니다."),
            () => useUiStore.getState().showToast("링크를 복사하지 못했습니다.", "error")
        );
    };

    return (
        <Flex justify="center" align="center" gap="3" py="5">
            <Button size="3" variant="soft" aria-label="추천" loading={voting === "U"} disabled={voting === "D"} onClick={() => void onVote("U")}>
                <ThumbsUp size={18}/>
                {upvotes || "X"}
                {fixedUpvotes && <Text size="2" color="gray">({fixedUpvotes})</Text>}
            </Button>
            {downvotes !== undefined && (
                <Button size="3" variant="soft" color="gray" aria-label="비추천" loading={voting === "D"} disabled={voting === "U"}
                        onClick={() => void onVote("D")}>
                    <ThumbsDown size={18}/>
                    {downvotes}
                </Button>
            )}
            <Tooltip content="링크 복사" container={overlay.portal}>
                <IconButton size="3" variant="ghost" color="gray" aria-label="링크 복사" onClick={onShare}>
                    <Link2 size={18}/>
                </IconButton>
            </Tooltip>
            <Tooltip content="새 탭으로 열기" container={overlay.portal}>
                <IconButton size="3" variant="ghost" color="gray" asChild>
                    <a href={preData?.link ?? location.href} target="_blank" rel="noreferrer">
                        <ExternalLink size={18}/>
                    </a>
                </IconButton>
            </Tooltip>
        </Flex>
    );
};

const ErrorBlock = ({error}: { error: ErrorState }) => {
    const preData = usePreviewStore((s) => s.preData);
    const {detail, status, adult} = error;

    let text: string;
    if (adult) text = "성인 인증이 필요한 글입니다. 원문에서 확인해 주세요.";
    else if (status && status >= 400 && status < 500) text = "게시글이 삭제되었거나 존재하지 않습니다.";
    else if (status && status >= 500) text = "서버가 불안정합니다. 잠시 후 다시 시도해주세요.";
    else if (/fetch|network|timed out/i.test(detail)) text = "서버 또는 브라우저 연결에 실패했습니다.";
    else text = "게시글 구조를 해석하는 데 실패했습니다.";

    return (
        <Callout.Root color={adult ? "orange" : "red"} my="4">
            <Callout.Icon><CircleAlert size={16}/></Callout.Icon>
            <Callout.Text>
                {text} {!adult && <Text size="1" color="gray">({detail})</Text>}
            </Callout.Text>
            <Flex gap="2">
                {/* 성인 인증은 원문 페이지에서만 된다. 인증한 뒤 다시 시도하면 미리보기로 볼 수 있다 */}
                {adult && (
                    <Button size="1" variant="soft" color="orange" asChild>
                        <a href={preData?.link ?? location.href} target="_blank" rel="noreferrer">
                            <ExternalLink size={14}/>
                            원문 열기
                        </a>
                    </Button>
                )}
                <Button
                    size="1"
                    variant="soft"
                    color={adult ? "gray" : "red"}
                    // 같은 글을 다시 열면 컨트롤러가 제자리에서 다시 받는다
                    onClick={() => preData && usePreviewStore.getState().requestOpen(preData, usePreviewStore.getState().commentsOnly)}
                >
                    다시 시도
                </Button>
            </Flex>
        </Callout.Root>
    );
};

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

/** 스크롤 끝에서 한 번 더 굴리면 넘어간다는 안내 (v5와 같은 모양과 문구) */
const SkipHint = ({dir}: { dir: number }) => (
    <div className="refresher-skip-hint" data-side={dir < 0 ? "top" : "bottom"}>
        <p>한번 더 스크롤 하면 {dir < 0 ? "이전" : "다음"} 게시글을 봅니다.</p>
    </div>
);

const CommentList = () => {
    const comments = usePreviewStore((s) => s.comments)!;
    const collapsed = usePreviewStore((s) => s.collapsed);
    const revealed = useUiStore((s) => s.blockView?.revealed === true);

    // 숨김 차단과 접힌 같은 댓글은 '가린 내용 보기' 동안만 (흐리게) 그린다. 블러 차단은 그려 두고 overlay.scss가 흐린다.
    // 트리 선과 답글 수도 그리는 댓글만 센다.
    const shown = new Set(revealed ? comments : comments.filter((comment) => comment.blocked !== "hide" && comment.duplicates !== 0));
    const parents = comments.filter((comment) => comment.depth === 0);
    // 답글을 쓰레드 첫 댓글 번호(c_no)로 한 번에 묶는다. 부모마다 전체를 훑으면 O(n²)이다.
    const repliesOf = Map.groupBy(comments.filter((comment) => comment.depth === 1 && shown.has(comment)), (comment) => comment.c_no);
    // 문서를 querySelector로 훑으므로 댓글마다가 아니라 여기서 한 번 잰다.
    // 모듈 전역에 두면 페이지를 다 읽기 전에 잰 false가 굳는다.
    const isAdmin = isGalleryManager();

    return (
        <Box py="1">
            {parents.map((parent) => {
                const replies = repliesOf.get(parent.no) ?? [];

                // 부모를 숨겼으면 답글을 들여쓰지 않고 그 자리에 그린다. 이어 줄 트리 선이 없다.
                if (!shown.has(parent)) {
                    return (
                        <Fragment key={parent.no}>
                            {replies.map((child) => <Comment key={child.no} comment={child} depth={0} replyCount={0} isAdmin={isAdmin}/>)}
                        </Fragment>
                    );
                }

                const isCollapsed = collapsed.has(parent.no);

                return (
                    <Fragment key={parent.no}>
                        <Comment comment={parent} depth={0} replyCount={replies.length} threadOpen={!isCollapsed && replies.length > 0} isAdmin={isAdmin}/>
                        {!isCollapsed && replies.map((child, index) => (
                            <Comment key={child.no} comment={child} depth={1} replyCount={0} lastReply={index === replies.length - 1} isAdmin={isAdmin}/>
                        ))}
                    </Fragment>
                );
            })}
        </Box>
    );
};

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
    const wheel = useRef({last: 0, armed: 0, key: ""});
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

        let armed = 0;
        if (atEdge && newGesture && state.armed === dir) goToAdjacent(dir);
        // 끝에 닿은 방향을 기억해 두고 다음 동작을 기다린다.
        else if (atEdge) armed = dir;

        if (armed !== state.armed) setHint({dir: armed, key: postKey});
        state.armed = armed;
    };

    const onWheel = (ev: WheelEvent<HTMLDivElement>): void => {
        if (!scrollToSkip || ev.deltaY === 0 || ev.ctrlKey || ev.shiftKey) return;

        const box = ev.currentTarget;
        const target = ev.target as Element;
        // 포털로 뜬 창(디시콘 등)의 휠도 React 트리를 타고 여기로 오므로, 스크롤 칸 DOM 안에서 난 것만 본다.
        if (!box.contains(target)) return;

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
                            <Heading as="h2" size="6">{post ? postTitle(post) : ""}</Heading>
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
                                        for (const media of button.parentElement?.querySelectorAll<HTMLElement>(":scope > [data-block]") ?? []) {
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
