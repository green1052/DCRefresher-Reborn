import {Box, Flex, IconButton, Text, Tooltip} from "@radix-ui/themes";
import {Check, ChevronDown, Reply as ReplyIcon, X} from "lucide-react";
import {type MouseEvent, useEffect, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import type {ProcessedComment} from "@/core/preview/comments";
import {adminDeleteComment, userDeleteComment} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";
import {ipInfoOf} from "@/core/database";
import {isGalleryManager} from "@/utils/user";

import {usePreviewStore} from "./previewStore";

const parseDate = (value: string): Date => {
    const missingYear = value.substring(0, 4).match(/\./);

    return new Date((missingYear ? `${new Date().getFullYear()}-` : "") + value.replace(/\./g, "-"));
};

const relative = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    if (Number.isNaN(diff) || diff < 0) return date.toLocaleString();
    if (diff < 3000) return "방금 전";

    const units: [string, number][] = [
        ["년", 31_536_000_000],
        ["주", 604_800_000],
        ["일", 86_400_000],
        ["시간", 3_600_000],
        ["분", 60_000],
        ["초", 1000]
    ];

    for (const [label, ms] of units) {
        if (diff >= ms) return `${Math.floor(diff / ms)}${label} 전`;
    }

    return date.toLocaleString();
};

const extractIcon = (html: string | undefined): string | undefined =>
    new DOMParser().parseFromString(html ?? "", "text/html").querySelector("a.writer_nikcon img")?.getAttribute("src") ?? undefined;

const extractIp = (html: string | undefined): string | undefined => html?.match(/class=["']?ip["']?[^>]*>\s*\(([^)]+)\)/)?.[1];

const TimeStamp = ({date}: { date: string }) => {
    const parsed = parseDate(date);
    const [absolute, setAbsolute] = useState(false);
    const [, force] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!document.hidden) force((x) => x + 1);
        }, 5000);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <Text size="1" color="gray" title={parsed.toLocaleString()} style={{cursor: "pointer", whiteSpace: "nowrap"}}
              onClick={() => setAbsolute((x) => !x)}>
            {Number.isNaN(parsed.getTime()) ? "이미 삭제 됨" : absolute ? parsed.toLocaleString() : relative(parsed)}
        </Text>
    );
};

export interface UserCardData {
    nick?: string;
    id?: string;
    ip?: string;
    image?: string;
}

/** 작성자 표시. 우클릭하면 유저 버블 */
export const UserCard = ({user}: { user: UserCardData }) => {
    const ipInfo = user.ip ? ipInfoOf(user.ip) : undefined;
    const ipColor = useUiStore((state) => (ipInfo ? state.ipColors[ipInfo.category] : undefined));
    const info = [user.id, user.ip].filter(Boolean).join(" / ");

    const openMenu = (event: MouseEvent): void => {
        event.preventDefault();

        const ui = useUiStore.getState();
        ui.setSelected({nick: user.nick, uid: user.id, ip: user.ip});
        ui.closeBubble();
        ui.openBubble(event.clientX, event.clientY);
    };

    return (
        <Flex align="center" gap="1" minWidth="0" onContextMenu={openMenu} style={{cursor: "context-menu"}}>
            <Text size="2" weight="bold" truncate>{user.nick ?? user.id ?? user.ip}</Text>
            {user.image && <img src={user.image} alt="" height={12}/>}
            {info && <Text size="1" color="gray" truncate>({info})</Text>}
            {ipInfo && <Text size="1" color={ipColor ? undefined : "blue"} style={{color: ipColor}} title={ipInfo.title} truncate>[{ipInfo.label}]</Text>}
        </Flex>
    );
};

interface CommentProps {
    comment: ProcessedComment;
    depth: number;
    replyCount: number;
    /** 답글이 펼쳐진 부모 — 아래로 트리 선을 긋는다 */
    threadOpen?: boolean;
    /** 쓰레드의 마지막 답글 — 트리 선이 여기서 끝난다 */
    lastReply?: boolean;
}

export const Comment = ({comment, depth, replyCount, threadOpen, lastReply}: CommentProps) => {
    const reply = usePreviewStore((s) => s.reply);
    const collapsed = usePreviewStore((s) => s.collapsed.has(comment.no));
    const setReply = usePreviewStore((s) => s.setReply);
    const toggleCollapse = usePreviewStore((s) => s.toggleCollapse);

    const isDeleted = comment.is_delete === "1";
    const isAdmin = isGalleryManager();
    const canDelete =
        !isDeleted && (comment.del_btn === "Y" || comment.my_cmt === "Y" || isAdmin || (!comment.user_id && Boolean(comment.ip)));
    const replying = reply.replyNo === comment.no;

    const onDelete = async (): Promise<void> => {
        const st = usePreviewStore.getState();
        if (!st.preData || !st.post) return;

        try {
            if (isAdmin) {
                await adminDeleteComment(st.preData, st.post.commentId ?? "");
            } else {
                let password = "";
                if (!comment.user_id) {
                    password = window.prompt("비밀번호를 입력하세요.") ?? "";
                    if (!password) return;
                }
                await userDeleteComment(st.preData, comment.no, password);
            }
            st.requestRefresh();
        } catch {
            useUiStore.getState().showToast("댓글 삭제 중 오류가 발생했습니다.", "error");
        }
    };

    const isDccon = /<(img|video) class=/.test(comment.memo);
    const html = isDccon
        ? comment.memo.replace(/(?<!(dc|<))img/gi, "/><img")
        : comment.memo.replace(/\n/g, "<br/>");

    return (
        <Box className="refresher-comment" data-depth={depth} data-deleted={isDeleted || undefined}
             data-thread-open={threadOpen || undefined} data-last-reply={lastReply || undefined} px="6" py="2">
            <Flex justify="between" align="center" gap="2">
                <Flex align="center" gap="1" minWidth="0">
                    <UserCard user={{
                        nick: comment.name,
                        id: comment.user_id,
                        ip: comment.ip || extractIp(comment.gallog_icon) || extractIp(comment.nickname as string | undefined),
                        image: extractIcon(comment.gallog_icon)
                    }}/>
                    {depth === 0 && replyCount > 1 && (
                        <Tooltip content={collapsed ? "답글 펼치기" : "답글 접기"} container={overlay.portal}>
                            <IconButton size="1" variant="ghost" color="gray" aria-label="답글 접기"
                                        onClick={() => toggleCollapse(comment.no)}>
                                <ChevronDown size={14} style={{transform: collapsed ? "rotate(-90deg)" : undefined}}/>
                            </IconButton>
                        </Tooltip>
                    )}
                </Flex>

                <Flex align="center" gap="3" flexShrink="0">
                    {!isDeleted && (
                        <IconButton
                            size="1"
                            // ghost 고정 — soft로 바꾸면 Radix가 여백을 달리 줘서 댓글 줄이 흔들린다
                            variant="ghost"
                            color={replying ? undefined : "gray"}
                            aria-label={replying ? "답글 취소" : "답글"}
                            aria-pressed={replying}
                            onClick={() =>
                                // 같은 댓글을 다시 누르면 취소. 답글의 부모는 쓰레드 첫 댓글(c_no), 첫 댓글이면 자기 자신
                                setReply(replying
                                    ? {commentNo: null, replyNo: null}
                                    : {commentNo: comment.c_no || comment.no, replyNo: comment.no})
                            }
                        >
                            {replying ? <Check size={14}/> : <ReplyIcon size={14}/>}
                        </IconButton>
                    )}
                    {canDelete && (
                        <IconButton size="1" variant="ghost" color="gray" aria-label="댓글 삭제"
                                    onClick={() => void onDelete()}>
                            <X size={14}/>
                        </IconButton>
                    )}
                    <TimeStamp date={String(comment.reg_date ?? comment.date_time ?? "")}/>
                </Flex>
            </Flex>

            <Flex direction="column" gap="1" mt="1">
                {comment.voice &&
                    (comment.voice.src.startsWith("https://vr.dcinside.com") ? (
                        <audio controls src={comment.voice.src}/>
                    ) : (
                        <iframe src={comment.voice.src} width={280} height={54} style={{border: 0}} title="voice"/>
                    ))}
                <Box className="refresher-html refresher-comment-html" data-dccon={isDccon || undefined}
                     dangerouslySetInnerHTML={{__html: html}}/>
            </Flex>
        </Box>
    );
};
