import {Box, Flex, IconButton, Text} from "@radix-ui/themes";
import {Check, ChevronDown, Reply as ReplyIcon, X} from "lucide-react";
import {useEffect, useLayoutEffect, useRef} from "react";

import type {ProcessedComment} from "@/core/preview/comments";
import type {User} from "@/core/preview/types";
import {adminDeleteComment, graphemes, userDeleteComment, wrapTxtcon} from "@/core/preview/request";
import {notifyManage} from "@/utils/notify";

import {savedNonmember} from "../nonmember";
import {openDcconInfo} from "./DcconInfoPopup";
import {watchGifVideos} from "./gifVideos";
import {NO_REPLY, usePreviewStore} from "./previewStore";
import {TimeStamp} from "./TimeStamp";
import {UserCard} from "./UserCard";

// 닉콘(a.writer_nikcon img)의 src. 댓글마다 DOMParser를 돌리지 않게 정규식으로 읽는다.
// 디시는 작은따옴표를 쓰지만 따옴표 없는 값도 받는다.
const extractIcon = (html: string | undefined): string | undefined => html?.match(/writer_nikcon[^>]*>\s*<img\b[^>]*?\ssrc=["']?([^"'\s>]+)/)?.[1];

const extractIp = (html: string | undefined): string | undefined => html?.match(/class=["']?ip["']?[^>]*>\s*\(([^)]+)\)/)?.[1];

/* ===== 글자콘: 디시 txtcon_view.js를 옮긴 것 (디시 스크립트는 shadow DOM 안을 건드리지 못한다) ===== */

/** 박스에 넘치지 않는 최대 글자 크기를 16~72px에서 이진 탐색한다. 줄 수는 16px일 때로 고정하고, 폭이 넘치면 break-all로 바꾼다. */
const fitTxtcon = (box: HTMLElement): void => {
    const txt = box.querySelector<HTMLElement>(".txtcon_txt");
    if (!txt || !box.getClientRects().length) return;

    Object.assign(txt.style, {wordBreak: "keep-all", overflowWrap: "normal", whiteSpace: "pre-line", letterSpacing: "", transform: ""});

    // 크기를 잴 인라인 span. 다시 불려도 wrapTxtcon은 이미 나눈 줄을 그대로 둔다.
    const meas = document.createElement("span");
    meas.textContent = wrapTxtcon(Array.from(txt.childNodes, (node) => (node.nodeName === "BR" ? "\n" : node.textContent)).join(""));
    txt.replaceChildren(meas);

    const style = getComputedStyle(box);
    const availW = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availH = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const tol = 0.5 / devicePixelRatio;

    const fit = (floor: number, keepLines: boolean): void => {
        txt.style.fontSize = `${floor}px`;
        const baseLines = keepLines ? meas.getClientRects().length : Infinity;
        let min = floor, max = 72, best = floor;
        while (min <= max) {
            const mid = Math.floor((min + max) / 2);
            txt.style.fontSize = `${mid}px`;
            const rect = meas.getBoundingClientRect();
            if (rect.width <= availW + tol && rect.height <= availH + tol && meas.getClientRects().length <= baseLines) {
                best = mid;
                min = mid + 1;
            } else {
                max = mid - 1;
            }
        }
        txt.style.fontSize = `${best}px`;
    };

    fit(16, true);
    if (meas.getBoundingClientRect().width > availW + tol) {
        txt.style.wordBreak = "break-all";
        fit(16, true);
    }

    // 16px로도 크게 넘치면 10px까지 줄여 담는다 (줄 수 제한 없음).
    const over = meas.getBoundingClientRect();
    if (over.height - availH > 4 || over.width - availW > 4) fit(10, false);

    // 남는 폭을 자간으로 채운다. 마지막 글자 뒤 자간만큼 치우치므로 transform으로 보정한다.
    // 글자 수는 디시처럼 이스케이프된 채로 센다 (&는 &amp; 5글자). 그래야 디시와 같은 자간이 나온다.
    const longest = Math.max(...meas.innerHTML.split("\n").map((line) => graphemes(line).length));
    const slack = availW - meas.getBoundingClientRect().width;
    if (longest > 1 && slack > 1) {
        const spacing = slack / longest;
        txt.style.letterSpacing = `calc(-0.045em + ${spacing.toFixed(2)}px)`;
        txt.style.transform = `translate(${(spacing / 2).toFixed(2)}px, -0.05em)`;
    }
};

interface CommentProps {
    comment: ProcessedComment;
    depth: number;
    replyCount: number;
    /** 답글이 펼쳐진 부모. 아래로 트리 선을 긋는다. */
    threadOpen?: boolean;
    /** 스레드의 마지막 답글. 트리 선이 여기서 끝난다. */
    lastReply?: boolean;
    /** 갤러리 관리 권한. 문서를 훑어 재므로 목록(CommentList)에서 한 번만 재서 넘긴다. */
    isAdmin: boolean;
}

export const Comment = ({comment, depth, replyCount, threadOpen, lastReply, isAdmin}: CommentProps) => {
    // reply 객체째 구독하면 답글 버튼 하나에 모든 댓글이 다시 그려지므로, 이 댓글이 대상인지만 구독한다.
    const replying = usePreviewStore((s) => s.reply.replyNo === comment.no);
    const collapsed = usePreviewStore((s) => s.collapsed.has(comment.no));
    const fresh = usePreviewStore((s) => s.freshComments.has(comment.no));
    const toggleCollapse = usePreviewStore((s) => s.toggleCollapse);
    // 글 작성자 아이디만 구독한다. 글 객체째 구독하면 추천·새로고침마다 모든 댓글이 다시 그려진다.
    const authorId = usePreviewStore((s) => s.post?.user?.id);
    const allowReply = usePreviewStore((s) => s.allowReply);

    const user: User = {
        nick: comment.name,
        id: comment.user_id,
        ip: comment.ip || extractIp(comment.gallog_icon) || extractIp(comment.nickname),
        image: extractIcon(comment.gallog_icon)
    };
    // 회원 아이디가 같을 때만 글쓴이로 본다. 유동은 닉과 IP 앞자리가 같아도 다른 사람일 수 있다.
    const isOp = Boolean(user.id) && user.id === authorId;

    const isDeleted = comment.is_delete === "1";
    // 디시처럼 멤버만 댓글(allow_reply)이면 답글도 막고, 답글이 막힌 댓글(reply_w)엔 버튼을 두지 않는다.
    // 음성 댓글은 디시도 reply_w와 상관없이 답글 버튼을 단다.
    // 그린 깊이(depth prop)가 아니라 댓글 자체의 깊이로 본다. 부모를 숨겨 들여쓰지 않은 답글도 답글이다.
    const canReply = !isDeleted && allowReply && (comment.depth > 0 || comment.voice !== undefined || comment.reply_w !== "N");
    const canDelete =
        !isDeleted && (comment.del_btn === "Y" || comment.my_cmt === "Y" || isAdmin || (!comment.user_id && Boolean(comment.ip)));

    const onDelete = async (): Promise<void> => {
        const st = usePreviewStore.getState();
        if (!st.preData || !st.post) return;

        // 비밀번호 없이 지워지는 삭제(관리자·회원 본인)는 X 한 번에 되돌릴 수 없으니 확인한다 (디시 comment.js와 같음).
        // 비밀번호 삭제는 prompt가 확인을 겸한다.
        const needsPassword = !isAdmin && !comment.user_id;
        if (!needsPassword && !window.confirm("댓글을 삭제할까요?")) return;

        let password = "";
        if (needsPassword) {
            // 미리보기에서 쓴 댓글은 저장해 둔 비밀번호를 썼으므로 기본값으로 채운다.
            password = window.prompt("댓글 비밀번호를 입력해 주세요.", savedNonmember().pw) ?? "";
            if (!password) return;
        }

        // 비밀번호가 틀려도 HTTP 200('false||메시지')이 오므로 결과를 확인해 알려야 한다.
        const request = isAdmin ? adminDeleteComment(st.preData, comment.no) : userDeleteComment(st.preData, comment.no, password);
        if (await notifyManage(request, "댓글을 삭제했습니다.", "댓글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.")) void st.requestRefresh();
    };

    // 디시콘(img/video)과 글자콘. 답글이면 앞에 멘션이 붙어 오므로 ^로 고정하지 않고 찾는다.
    const isDccon = /<(img|video) class=|<div class="coment_dccon_txt/.test(comment.memo);
    // 디시콘 HTML은 줄바꿈을 <br/>로 바꾸지 않는다. 붙어 온 디시콘 태그는 comments.ts(splitDccons)가 이미 나눠 두었다.
    const html = isDccon ? comment.memo : comment.memo.replace(/\n/g, "<br/>");

    // 글자콘 크기는 그려진 뒤에 잰다. html이 바뀌면 React가 내용을 새로 넣으므로 다시 잰다.
    const body = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        for (const box of body.current?.querySelectorAll<HTMLElement>(".coment_dccon_txt") ?? []) fitTxtcon(box);
    }, [html]);
    // 깨진 디시콘 mp4는 디시처럼 gif로 바꾼다.
    useEffect(() => (body.current ? watchGifVideos(body.current) : undefined), [html]);

    return (
        <Box className="refresher-comment" data-depth={depth} data-deleted={isDeleted || undefined}
             data-blocked={comment.blocked} data-duplicate={comment.duplicates === 0 || undefined} data-fresh={fresh || undefined}
             data-thread-open={threadOpen || undefined} data-last-reply={lastReply || undefined} px="6" py="2">
            <Flex justify="between" align="center" gap="2">
                <Flex align="center" gap="1" minWidth="0">
                    <UserCard user={user} op={isOp}/>
                    {comment.duplicates ? <Text size="1" color="gray" style={{whiteSpace: "nowrap"}}>같은 댓글 ×{comment.duplicates}</Text> : null}
                    {/* 툴팁은 브라우저 기본(title)을 쓴다. 스레드마다 Radix 툴팁을 달면 댓글이 많은 글을 열 때 느려진다. */}
                    {depth === 0 && replyCount > 1 && (
                        <IconButton size="1" variant="ghost" color="gray" aria-label={collapsed ? "답글 펼치기" : "답글 접기"}
                                    title={collapsed ? "답글 펼치기" : "답글 접기"} onClick={() => toggleCollapse(comment.no)}>
                            <ChevronDown size={14} className="refresher-chevron" style={{transform: collapsed ? "rotate(-90deg)" : undefined}}/>
                        </IconButton>
                    )}
                </Flex>

                <Flex align="center" gap="3" flexShrink="0">
                    {canReply && (
                        <IconButton
                            size="1"
                            // 선택 중에도 ghost를 유지한다. soft로 바꾸면 Radix 여백이 달라져 댓글 줄이 흔들린다.
                            variant="ghost"
                            color={replying ? undefined : "gray"}
                            aria-label="답글"
                            aria-pressed={replying}
                            onClick={() =>
                                // 같은 댓글을 다시 누르면 취소한다. 답글의 부모는 스레드 첫 댓글(c_no)이고, 첫 댓글이면 자기 자신이다.
                                usePreviewStore.setState({
                                    reply: replying ? NO_REPLY : {commentNo: comment.c_no || comment.no, replyNo: comment.no}
                                })
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
                    (comment.voice.iframe ? (
                        <iframe src={comment.voice.src} width={280} height={54} style={{border: 0}} title="voice"/>
                    ) : (
                        <audio controls src={comment.voice.src}/>
                    ))}
                <Box ref={body} className="refresher-html refresher-comment-html" data-dccon={isDccon || undefined}
                     onClick={isDccon ? openDcconInfo : undefined}
                     dangerouslySetInnerHTML={{__html: html}}/>
            </Flex>
        </Box>
    );
};
