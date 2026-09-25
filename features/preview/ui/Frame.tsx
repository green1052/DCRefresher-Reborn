import {Badge, Box, Button, Callout, Flex, Heading, IconButton, Separator, Spinner, Text, Theme, Tooltip} from "@radix-ui/themes";
import {ArrowUp, CircleAlert, Clock, ExternalLink, Eye, MessageSquare, ThumbsDown, ThumbsUp} from "lucide-react";
import {Dialog} from "radix-ui";
import {Fragment, useEffect, useRef, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {captchaImage, vote} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";
import {isTyping} from "@/utils/event";

import {buildPreData} from "../index";
import {Comment, UserCard} from "./Comment";
import {type ErrorState, usePreviewStore} from "./previewStore";
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
    const {detail} = error;

    let text: string;
    if (/fetch/i.test(detail)) text = "서버 또는 브라우저 연결에 실패했습니다.";
    else if (detail.startsWith("4")) text = "게시글이 삭제되었거나 존재하지 않습니다.";
    else if (detail.startsWith("5")) text = "서버가 불안정합니다. 잠시 후 다시 시도해주세요.";
    else text = "게시글 구조를 해석하는 데 실패했습니다.";

    return (
        <Callout.Root color="red" my="4">
            <Callout.Icon><CircleAlert size={16}/></Callout.Icon>
            <Callout.Text>
                {text} <Text size="1" color="gray">({detail})</Text>
            </Callout.Text>
            <Box>
                <Button
                    size="1"
                    variant="soft"
                    color="red"
                    onClick={() => {
                        const st = usePreviewStore.getState();
                        if (!preData) return;
                        st.requestClose();
                        st.requestOpen(preData);
                    }}
                >
                    다시 시도
                </Button>
            </Box>
        </Callout.Root>
    );
};

const CommentList = () => {
    const comments = usePreviewStore((s) => s.comments)!;
    const collapsed = usePreviewStore((s) => s.collapsed);

    const parents = comments.filter((comment) => comment.depth === 0);

    return (
        <Box py="1">
            {parents.map((parent) => {
                const replies = comments.filter((comment) => comment.depth === 1 && comment.c_no === parent.no);
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
    const scroller = useRef<HTMLDivElement>(null);
    const commentsSection = useRef<HTMLDivElement>(null);

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
            if (isTyping(event)) return;

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

    const busy = !error && (loading || !post);

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
                    // pointerdown에서 닫으면 배경이 곧바로 사라져 이어지는 click/contextmenu가 아래 게시글에 떨어진다
                    // (우클릭으로 닫으면 다른 글 미리보기가 열림) — 배경이 받는 click/contextmenu에서 닫는다
                    onClick={() => usePreviewStore.getState().requestClose()}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        usePreviewStore.getState().requestClose();
                    }}
                />
                <Dialog.Content
                    className="refresher-frame"
                    data-fading={fading || undefined}
                    aria-busy={busy}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    // 바깥 클릭 닫기는 배경(frame-outer)이 담당. 위에 뜬 팝업/버블 클릭으로 닫히지 않게 막는다
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    {/* 스크롤은 안쪽에서 — 바깥이 스크롤되면 스크롤바가 오른쪽 둥근 모서리를 덮는다 */}
                    <div className="refresher-frame-scroll" ref={scroller}>
                    <Box px="6" pt="5" pb="3">
                        <Dialog.Title asChild>
                            <Heading as="h2" size="6" dangerouslySetInnerHTML={{__html: title}}/>
                        </Dialog.Title>

                        {post && (
                            <Flex justify="between" align="center" gap="3" mt="3" wrap="wrap">
                                <UserCard user={post.user ?? {}}/>
                                <Flex align="center" gap="3">
                                    <CountDown/>
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
                                    className={"refresher-html refresher-preview-contents" + (imageBlocked ? " refresher-preview-block-media" : "")}
                                    onClick={(event) => {
                                        if ((event.target as HTMLElement).closest(".btn_img_block")) {
                                            event.preventDefault();
                                            usePreviewStore.getState().setImageBlocked(false);
                                        }
                                    }}
                                    dangerouslySetInnerHTML={{__html: contents ?? ""}}
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
                        <Box ref={commentsSection} style={{scrollMarginTop: 0}}>
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
