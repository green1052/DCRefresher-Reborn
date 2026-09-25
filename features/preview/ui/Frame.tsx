import {Badge, Box, Button, Callout, Flex, Heading, IconButton, Separator, Spinner, Text, Theme, Tooltip} from "@radix-ui/themes";
import {ArrowUp, CircleAlert, Clock, ExternalLink, Eye, MessageSquare, ThumbsDown, ThumbsUp} from "lucide-react";
import {Dialog} from "radix-ui";
import {type CSSProperties, Fragment, useEffect, useRef, type WheelEvent} from "react";

import {overlay} from "@/components/overlay/shadow";
import {captchaImage, vote} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";
import {isTyping} from "@/utils/event";

import {buildPreData} from "../index";
import {Comment, TimeStamp, useTick, UserCard} from "./Comment";
import {BLOCKED_TEXT, type ErrorState, usePreviewStore} from "./previewStore";
import {WriteComment} from "./WriteComment";

/**
 * 디시 동영상(movie_view 등 같은 출처 iframe)은 자기 크기를 `$('#movieIcon'+no, parent.document).height(...)`로 맞추는데,
 * 미리보기는 shadow DOM 안이라 거기서 못 찾아 기본 300×150으로 잘린다 — 안쪽 내용을 재서 대신 맞춘다 (다른 출처는 못 읽어 그대로)
 */
const fitMovies = (root: HTMLElement): (() => void) => {
    const observers = new Map<HTMLIFrameElement, ResizeObserver>();
    const listeners = new AbortController();

    for (const frame of root.querySelectorAll<HTMLIFrameElement>("iframe")) {
        const fit = (): void => {
            // 프레임당 옵저버 하나 — 다시 로드되면 떠난 문서를 보던 옵저버는 끊는다 (분리된 요소가 0으로 재어져 프레임이 접힌다)
            observers.get(frame)?.disconnect();

            const doc = frame.contentDocument;
            // movie_view는 .v-container, 그 밖엔 본문 첫 요소를 잰다
            const container = doc?.querySelector<HTMLElement>(".v-container") ?? doc?.body?.firstElementChild;
            if (!doc || !(container instanceof doc.defaultView!.HTMLElement)) return;

            // 글꼴·배율에 따라 1px만 넘쳐도 스크롤바가 생겨 화면을 더 먹는다 — 안쪽 스크롤은 끈다
            doc.documentElement.style.overflow = "hidden";

            const observer = new ResizeObserver(() => {
                // 다시 로드되는 중(load 전)엔 떠난 문서의 요소가 0으로 재어져 프레임이 접힌다 — 무시한다
                if (frame.contentDocument !== doc) return;
                // 안쪽 body 여백(좌우 대칭)까지, 소수점은 올림 — 컨테이너 폭만 주면 잘린다
                const {width, height} = container.getBoundingClientRect();
                frame.style.width = `${Math.ceil(width + container.offsetLeft * 2)}px`;
                frame.style.height = `${Math.ceil(height + container.offsetTop * 2)}px`;
            });
            observer.observe(container);
            observers.set(frame, observer);
        };

        if (frame.contentDocument?.readyState === "complete" && frame.contentDocument.URL !== "about:blank") fit();
        // 다시 로드되면(새로고침 등) 안쪽 문서가 바뀌므로 매번 맞춘다
        frame.addEventListener("load", fit, {signal: listeners.signal});
    }

    return () => {
        listeners.abort();
        for (const observer of observers.values()) observer.disconnect();
    };
};

const Remaining = ({expire}: { expire: Date }) => {
    // 1시간 미만이면 초까지 보여 주므로 1초마다
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

// 만료 시각이 있는 글만 — 대부분 없어서 1초 타이머를 돌릴 까닭이 없다
const CountDown = () => {
    const expire = usePreviewStore((s) => s.expire);
    return expire && !Number.isNaN(expire.getTime()) ? <Remaining expire={expire}/> : null;
};

const Votes = () => {
    const preData = usePreviewStore((s) => s.preData);
    const post = usePreviewStore((s) => s.post);
    const upvotes = usePreviewStore((s) => s.upvotes);
    const fixedUpvotes = usePreviewStore((s) => s.fixedUpvotes);
    const downvotes = usePreviewStore((s) => s.downvotes);

    const onVote = async (mode: "U" | "D"): Promise<void> => {
        if (!preData || !post) return;
        const signal = usePreviewStore.getState().signalId;
        try {
            let code: string | undefined;
            if (post.requireCaptcha) {
                code = await usePreviewStore.getState().openCaptcha(captchaImage(preData, "recommend"));
                if (!code) return;
            }

            const result = await vote(preData, post, mode, code);
            if (result.success) {
                // 응답 전에 다른 글로 넘어갔으면 숫자는 그 글 것이 아니다 — 알림만
                if (usePreviewStore.getState().signalId === signal) {
                    const counts = result.counts ?? (mode === "U" ? upvotes : downvotes);
                    if (mode === "U") usePreviewStore.getState().setVotes(counts ?? "X", result.fixedCounts ?? "");
                    else usePreviewStore.setState({downvotes: counts});
                }
                useUiStore
                    .getState()
                    .showToast(`${mode === "U" ? "추천" : "비추천"}되었습니다.`);
            } else {
                useUiStore.getState().showToast(result.message ?? "처리하지 못했습니다.", "error");
            }
        } catch {
            useUiStore.getState().showToast("추천 처리 중 오류가 발생했습니다.", "error");
        }
    };

    return (
        <Flex justify="center" align="center" gap="3" py="5">
            <Button size="3" variant="soft" aria-label="추천" onClick={() => void onVote("U")}>
                <ThumbsUp size={18}/>
                {upvotes || "X"}
                {fixedUpvotes && <Text size="2" color="gray">({fixedUpvotes})</Text>}
            </Button>
            {downvotes !== undefined && (
                <Button size="3" variant="soft" color="gray" aria-label="비추천" onClick={() => void onVote("D")}>
                    <ThumbsDown size={18}/>
                    {downvotes}
                </Button>
            )}
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
                {/* 인증은 원문(디시 페이지)에서만 된다 — 인증한 뒤 다시 시도하면 미리보기로 볼 수 있다 */}
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
                    onClick={() => {
                        const st = usePreviewStore.getState();
                        if (!preData) return;
                        st.requestClose();
                        st.requestOpen(preData);
                    }}
                >
                    다시 시도
                </Button>
            </Flex>
        </Callout.Root>
    );
};

/** 목록에서 앞(-1)/뒤(1) 글로 — PageUp/Down과 스크롤 끝에서 한 번 더 굴리기가 같이 쓴다 */
const goToAdjacent = (dir: number): void => {
    const st = usePreviewStore.getState();
    if (!st.preData) return;

    // 차단·운영자 숨김 행은 건너뛴다 — 미리보기는 TEXT 차단만 검사해서 숨긴 글이 그대로 열린다
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".gall_list .ub-content")).filter((row) =>
        row.checkVisibility() && row.querySelector("a:not(.reply_numbox)")
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

/** 이만큼 쉬었다 굴리면 새 휠 동작으로 본다 — 관성 스크롤은 이벤트가 이보다 촘촘하게 이어진다 */
const WHEEL_GESTURE_GAP = 250;

const CommentList = () => {
    const comments = usePreviewStore((s) => s.comments)!;
    const collapsed = usePreviewStore((s) => s.collapsed);

    const parents = comments.filter((comment) => comment.depth === 0);
    // 답글은 쓰레드 첫 댓글 번호(c_no)로 한 번에 묶는다 — 부모마다 전체를 훑으면 O(n²)
    const repliesOf = Map.groupBy(comments.filter((comment) => comment.depth === 1), (comment) => comment.c_no);

    return (
        <Box py="1">
            {parents.map((parent) => {
                const replies = repliesOf.get(parent.no) ?? [];
                const isCollapsed = collapsed.has(parent.no);

                return (
                    <Fragment key={parent.no}>
                        <Comment comment={parent} depth={0} replyCount={replies.length} threadOpen={!isCollapsed && replies.length > 0}/>
                        {!isCollapsed &&
                            replies.map((child, index) => <Comment key={child.no} comment={child} depth={1} replyCount={0} lastReply={index === replies.length - 1}/>)}
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
    const title = usePreviewStore((s) => s.title);
    const subtitle = usePreviewStore((s) => s.subtitle);
    const contents = usePreviewStore((s) => s.contents);
    const views = usePreviewStore((s) => s.views);
    const error = usePreviewStore((s) => s.error);
    const comments = usePreviewStore((s) => s.comments);
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

    // 본문 칸은 댓글만 보기·오류·닫힘일 때 빠졌다가 다시 붙고, 글마다 새로 마운트된다 — 그때도 다시 맞춘다
    // (같은 글을 캐시로 다시 열면 나머지 값이 모두 같아 visible이 없으면 다시 돌지 않는다)
    useEffect(() => (contentsBox.current ? fitMovies(contentsBox.current) : undefined), [visible, contents, commentsOnly, error, postKey]);

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
            // Ctrl+PageUp/Down(탭 전환) 같은 조합키는 브라우저 몫
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

    // 스크롤 끝에서 한 번 더 굴리면 이전/다음 글. 끝에 닿은 그 동작으로는 넘기지 않는다 — 트랙패드 관성에 글이 연달아 넘어간다
    const wheel = useRef({last: 0, armed: 0});
    const onWheel = (ev: WheelEvent<HTMLDivElement>): void => {
        if (!scrollToSkip || ev.deltaY === 0 || ev.ctrlKey || ev.shiftKey) return;

        const box = ev.currentTarget;
        const dir = ev.deltaY > 0 ? 1 : -1;
        const atEdge = dir > 0 ? box.scrollTop + box.clientHeight >= box.scrollHeight - 2 : box.scrollTop <= 0;
        const state = wheel.current;
        const newGesture = ev.timeStamp - state.last > WHEEL_GESTURE_GAP;
        state.last = ev.timeStamp;

        if (!atEdge) {
            state.armed = 0;
        } else if (newGesture && state.armed === dir) {
            state.armed = 0;
            goToAdjacent(dir);
        } else {
            // 끝에 닿은 방향을 기억해 두고 다음 동작을 기다린다
            state.armed = dir;
        }
    };

    if (!visible && !fading) return null;

    const busy = !error && !post;
    // 본문 차단: 숨김이면 '가린 내용 보기' 동안만 원문을 흐리게 보인다 (overlay.scss의 data-blocked)
    const hideText = post?.textBlocked === "hide" && !blockView?.revealed;

    return (
        // Themes Dialog는 항상 modal이라 프리미티브를 쓴다 (스크롤 잠금·PageUp/Down 이동을 직접 처리)
        <Dialog.Root
            open
            modal={false}
            onOpenChange={(open) => {
                if (!open) usePreviewStore.getState().requestClose();
            }}
        >
            <Dialog.Portal container={overlay.portal}>
                {/* 프리미티브 포털은 Theme 밖(#portal)에 그려져 토큰이 없다 — Themes 컴포넌트처럼 Theme로 다시 감싼다 */}
                <Theme>
                <div
                    className="refresher-frame-outer"
                    data-fading={fading || undefined}
                    data-blur={backgroundBlur || undefined}
                    // pointerdown에서 닫으면 배경이 곧바로 사라져 이어지는 click/contextmenu가 아래 게시글에 떨어진다
                    // (우클릭으로 닫으면 다른 글 미리보기가 열림) — 배경이 받는 click/contextmenu에서 닫는다
                    onClick={() => usePreviewStore.getState().requestClose()}
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
                    // 너비는 overlay.scss가 화면 폭·관리 패널에 맞춰 줄인다
                    style={{"--refresher-frame-width": `${frameWidth}px`} as CSSProperties}
                    aria-busy={busy}
                    onOpenAutoFocus={(ev) => ev.preventDefault()}
                    // 바깥 클릭 닫기는 배경(frame-outer)이 담당. 위에 뜬 팝업/버블 클릭으로 닫히지 않게 막는다
                    onInteractOutside={(ev) => ev.preventDefault()}
                >
                    {/* 스크롤은 안쪽에서 — 바깥이 스크롤되면 스크롤바가 오른쪽 둥근 모서리를 덮는다 */}
                    {/* 글마다 새로 마운트 — 캐시 hit이면 한 번에 렌더돼 스크롤 위치와 쓰던 댓글이 다음 글로 넘어간다.
                        signalId는 닫을 때도 올라 페이드아웃 중에 맨 위로 튀므로 글 주소로 건다 */}
                    <div className="refresher-frame-scroll" ref={scroller} key={postKey} onWheel={onWheel}>
                    <Box px="6" pt="5" pb="3">
                        <Dialog.Title asChild>
                            <Heading as="h2" size="6">{title}</Heading>
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
                                            {views}
                                        </Flex>
                                    </Text>
                                </Flex>
                            </Flex>
                        )}
                    </Box>

                    <Separator size="4"/>

                    <Box px="6" pt="5">
                        {commentsOnly ? (
                            <Button variant="soft" color="gray" style={{width: "100%"}} mb="5"
                                    onClick={() => usePreviewStore.getState().setCommentsOnly(false)}>
                                댓글만 표시 중입니다. 눌러서 원문 보기
                            </Button>
                        ) : error ? (
                            <ErrorBlock error={error}/>
                        ) : (
                            <>
                                <Box
                                    ref={contentsBox}
                                    className={"refresher-html refresher-preview-contents" + (imageBlocked ? " refresher-preview-block-media" : "")}
                                    data-blocked={hideText ? undefined : post?.textBlocked}
                                    onClick={(ev) => {
                                        if ((ev.target as HTMLElement).closest(".btn_img_block")) {
                                            ev.preventDefault();
                                            usePreviewStore.getState().setImageBlocked(false);
                                        }
                                    }}
                                    dangerouslySetInnerHTML={{__html: hideText ? BLOCKED_TEXT : contents ?? ""}}
                                />
                                {post && <Votes/>}
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
                            <Box px="6" pt="3">
                                <Text size="2" color="gray">{subtitle}</Text>
                            </Box>
                            {comments.length === 0 ? (
                                <Box py="6"><Text as="p" size="2" color="gray" align="center">댓글이 없습니다.</Text></Box>
                            ) : (
                                <CommentList/>
                            )}
                        </Box>
                    )}

                    {post && <WriteComment/>}
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
                </Theme>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
