import {Check, ChevronDown, Reply as ReplyIcon, X} from "lucide-react";
import {useEffect, useLayoutEffect, useRef} from "react";

import {Button} from "@/components/ui/button";
import type {ProcessedComment} from "@/core/preview/comments";
import type {User} from "@/core/preview/types";
import {adminDeleteComment, userDeleteComment} from "@/core/preview/request";
import {notifyManage} from "@/stores/notify";
import {cn} from "cn";

import {savedNonmember} from "../nonmember";
import {openDcconInfo} from "./DcconInfoPopup";
import {fitTxtcon} from "./fitTxtcon";
import {watchGifVideos} from "./gifVideos";
import {NO_REPLY, usePreviewStore} from "./previewStore";
import {TimeStamp} from "./TimeStamp";
import {UserCard} from "./UserCard";

// 닉콘(a.writer_nikcon img)의 src. 댓글마다 DOMParser를 돌리지 않게 정규식으로 읽는다.
// 디시는 작은따옴표를 쓰지만 따옴표 없는 값도 받는다.
const extractIcon = (html: string | undefined): string | undefined => html?.match(/writer_nikcon[^>]*>\s*<img\b[^>]*?\ssrc=["']?([^"'\s>]+)/)?.[1];

const extractIp = (html: string | undefined): string | undefined => html?.match(/class=["']?ip["']?[^>]*>\s*\(([^)]+)\)/)?.[1];

/**
 * 유튜브식 답글 트리. 부모 이름 아래에서 내려온 선이 답글마다 ㄴ자로 꺾여 들어간다 (x좌표: 부모 본문 시작 32px + 12px = 답글 안에서 12px).
 * 선은 모두 칸 안에 그려 content-visibility로 잘리지 않는다. 불투명 색을 쓴다: ㄴ과 이어지는 세로선이 겹치는 구간이 반투명이면 두 번 칠해져 진해진다.
 */
// Tailwind가 소스에서 클래스 이름을 읽어 CSS를 만들므로 이어 붙이지 않고 다 적는다.
/** 부모: 본문 아래 여백만큼 세로선 (본문이 여러 줄이어도 글자를 가로지르지 않게) → 첫 답글의 ㄴ으로 이어진다. */
const THREAD_OPEN = "after:pointer-events-none after:absolute after:bottom-0 after:left-11 after:h-2 after:border-l-2 after:border-zinc-300 after:content-[''] dark:after:border-zinc-700";
/** 답글: 위에서 내려와 이름 높이에서 오른쪽으로 꺾이는 ㄴ. */
const REPLY = "ml-8 before:pointer-events-none before:absolute before:top-0 before:left-3 before:h-4.5 before:w-3.5 before:rounded-bl-[10px] before:border-b-2 before:border-l-2 before:border-zinc-300 before:content-[''] dark:before:border-zinc-700";
/** 마지막 답글이 아니면 다음 답글까지 세로선을 잇는다. */
const REPLY_CONTINUES = "after:pointer-events-none after:absolute after:inset-y-0 after:left-3 after:border-l-2 after:border-zinc-300 after:content-[''] dark:after:border-zinc-700";

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
    // 디시콘 HTML은 줄바꿈을 <br/>로 바꾸지 않는다. 붙어 온 디시콘 태그는 core/preview/comments.ts(splitDccons)가 이미 나눠 두었다.
    const html = isDccon ? comment.memo : comment.memo.replace(/\n/g, "<br/>");

    // 글자콘 크기는 그려진 뒤에 잰다. html이 바뀌면 React가 내용을 새로 넣으므로 다시 잰다. 글만 있는 댓글(대부분)은 훑지 않는다.
    const body = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (!isDccon) return;
        for (const box of body.current?.querySelectorAll<HTMLElement>(".coment_dccon_txt") ?? []) fitTxtcon(box);
    }, [html, isDccon]);
    // 깨진 디시콘 mp4는 디시처럼 gif로 바꾼다.
    useEffect(() => (isDccon && body.current ? watchGifVideos(body.current) : undefined), [html, isDccon]);

    return (
        // 화면 밖 댓글은 레이아웃·스타일 계산을 건너뛴다 (댓글 수백 개인 글을 열 때 레이아웃이 크게 준다).
        // 아직 그리지 않은 댓글은 가장 흔한 한 줄 댓글 높이(48px)로 어림한다. 크게 잡으면 답글을 펼칠 때 어림값으로 높이를 재
        // 펼치는 동안 실제보다 늘었다가 줄고, 그리지 않은 댓글이 많은 글은 스크롤 길이도 부풀었다가 줄어든다.
        <div className={cn("refresher-comment relative px-8 py-2 [contain-intrinsic-size:auto_48px] [content-visibility:auto] hover:bg-muted/50",
                           // 자동 새로고침으로 새로 들어온 댓글 (previewStore의 freshComments). 강조색으로 깔았다가 걷는다.
                           fresh && "animate-fresh-comment",
                           threadOpen && THREAD_OPEN, depth === 1 && REPLY, depth === 1 && !lastReply && REPLY_CONTINUES)}
             data-deleted={isDeleted || undefined} data-blocked={comment.blocked} data-duplicate={comment.duplicates === 0 || undefined} data-fresh={fresh || undefined}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                    <UserCard user={user} op={isOp}/>
                    {comment.duplicates ? <span className="text-xs whitespace-nowrap text-muted-foreground">같은 댓글 ×{comment.duplicates}</span> : null}
                    {/* 툴팁은 브라우저 기본(title)을 쓴다. 스레드마다 툴팁 부품을 달면 댓글이 많은 글을 열 때 느려진다. */}
                    {depth === 0 && replyCount > 1 && (
                        <Button size="icon-xs" variant="ghost" aria-label={collapsed ? "답글 펼치기" : "답글 접기"}
                                title={collapsed ? "답글 펼치기" : "답글 접기"} onClick={() => toggleCollapse(comment.no)}>
                            <ChevronDown className={cn("transition-transform motion-reduce:transition-none", collapsed && "-rotate-90")}/>
                        </Button>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    {canReply && (
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            className={cn(replying && "text-link")}
                            aria-label="답글"
                            aria-pressed={replying}
                            onClick={() =>
                                // 같은 댓글을 다시 누르면 취소한다. 답글의 부모는 스레드 첫 댓글(c_no)이고, 첫 댓글이면 자기 자신이다.
                                usePreviewStore.setState({
                                    reply: replying ? NO_REPLY : {commentNo: comment.c_no || comment.no, replyNo: comment.no}
                                })
                            }
                        >
                            {replying ? <Check/> : <ReplyIcon/>}
                        </Button>
                    )}
                    {canDelete && (
                        <Button size="icon-xs" variant="ghost" aria-label="댓글 삭제" onClick={() => void onDelete()}>
                            <X/>
                        </Button>
                    )}
                    <TimeStamp date={String(comment.reg_date ?? comment.date_time ?? "")}/>
                </div>
            </div>

            {/* 음성 댓글만 본문 위에 플레이어가 붙는다. */}
            {comment.voice && (
                <div className="mt-1">
                    {comment.voice.iframe ? (
                        <iframe src={comment.voice.src} width={280} height={54} className="block border-0" title="voice"/>
                    ) : (
                        <audio controls src={comment.voice.src} className="block"/>
                    )}
                </div>
            )}
            {/* 지운 댓글은 읽을 수 있게 본문용 회색을 쓴다. */}
            <div ref={body} className={cn("refresher-html refresher-comment-html mt-1", isDeleted && "text-muted-foreground")} data-dccon={isDccon || undefined}
                 onClick={isDccon ? openDcconInfo : undefined}
                 dangerouslySetInnerHTML={{__html: html}}/>
        </div>
    );
};
