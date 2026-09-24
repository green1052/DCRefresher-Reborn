import {useEffect, useState, type MouseEvent} from "react";
import {Check, ChevronDown, Reply as ReplyIcon, X} from "lucide-react";

import {adminDeleteComment, userDeleteComment} from "@/core/preview/request";
import {ISPData} from "@/utils/ip";
import type {ProcessedComment} from "@/core/preview/comments";
import {useUiStore} from "@/stores/ui";

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

const TimeStamp = ({date}: {date: string}) => {
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
        <span
            className="refresher-timestamp"
            onClick={() => setAbsolute((x) => !x)}
            title={parsed.toLocaleString()}
        >
            {Number.isNaN(parsed.getTime()) ? "이미 삭제 됨" : absolute ? parsed.toLocaleString() : relative(parsed)}
        </span>
    );
};

export interface UserCardData {
    nick?: string;
    id?: string;
    ip?: string;
    image?: string;
}

export const UserCard = ({user}: {user: UserCardData}) => {
    const isp = user.ip ? ISPData(user.ip).name : undefined;

    const openMenu = (event: MouseEvent): void => {
        event.preventDefault();

        const ui = useUiStore.getState();
        ui.setSelected({nick: user.nick, uid: user.id, ip: user.ip});
        ui.closeBubble();
        ui.openBubble(event.clientX, event.clientY);
    };

    return (
        <div className="refresher-user" onContextMenu={openMenu}>
            <div className="refresher-user-content">
                <span className="refresher-user-nick">{user.nick ?? user.id ?? user.ip}</span>
                {user.image && (
                    <span className="refresher-user-icon">
                        <img src={user.image} alt="" />
                    </span>
                )}
                {(user.id || user.ip) && <span className="refresher-user-info">({user.id || user.ip})</span>}
                {isp && (
                    <span className="refresherUserData" style={{color: "#6495ed"}} title={isp}>
                        [{isp}]
                    </span>
                )}
            </div>
        </div>
    );
};

interface CommentProps {
    comment: ProcessedComment;
    depth: number;
    replyCount: number;
}

export const Comment = ({comment, depth, replyCount}: CommentProps) => {
    const reply = usePreviewStore((s) => s.reply);
    const collapsed = usePreviewStore((s) => s.collapsed.has(comment.no));

    const isDeleted = comment.is_delete === "1";
    const isAdmin = Boolean(document.querySelector(".useradmin_btnbox button"));
    const canDelete =
        !isDeleted && (comment.del_btn === "Y" || comment.my_cmt === "Y" || isAdmin || (!comment.user_id && Boolean(comment.ip)));

    const setReply = usePreviewStore((s) => s.setReply);
    const toggleCollapse = usePreviewStore((s) => s.toggleCollapse);

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
        <div
            className="refresher-comment"
            data-depth={depth}
            data-collapsed={collapsed ? "true" : undefined}
            data-deleted={isDeleted ? "true" : undefined}
        >
            <div className="refresher-comment-meta">
                <UserCard user={{nick: comment.name, id: comment.user_id, ip: comment.ip || extractIp(comment.gallog_icon) || extractIp(comment.nickname as string | undefined), image: extractIcon(comment.gallog_icon)}} />
                {depth === 0 && replyCount > 1 && (
                    <button
                        type="button"
                        className="refresher-comment-controls"
                        title="답글 접기"
                        onClick={() => toggleCollapse(comment.no)}
                    >
                        <ChevronDown size={16} style={{transform: collapsed ? "rotate(-90deg)" : undefined}} />
                        {replyCount}
                    </button>
                )}
                <div className="refresher-comment-controls-container">
                    {!isDeleted && (
                        <button
                            type="button"
                            className="refresher-comment-controls"
                            onClick={() =>
                                setReply({
                                    commentNo: comment.c_no === reply.commentNo ? null : comment.c_no || "0",
                                    replyNo: comment.no
                                })
                            }
                        >
                            {reply.replyNo === comment.no ? <Check size={15} /> : <ReplyIcon size={15} />}
                        </button>
                    )}
                    {canDelete && (
                        <button type="button" className="refresher-comment-controls" title="댓글 삭제" onClick={() => void onDelete()}>
                            <X size={15} />
                        </button>
                    )}
                    <TimeStamp date={String(comment.reg_date ?? comment.date_time ?? "")} />
                </div>
            </div>
            <div className="refresher-comment-content-inner">
                {comment.voice &&
                    (comment.voice.src.startsWith("https://vr.dcinside.com") ? (
                        <audio controls src={comment.voice.src} />
                    ) : (
                        <iframe src={comment.voice.src} width={280} height={54} style={{border: 0}} title="voice" />
                    ))}
                <div className={"refresher-comment-content" + (isDccon ? " dccon" : "")} dangerouslySetInnerHTML={{__html: html}} />
            </div>
        </div>
    );
};
