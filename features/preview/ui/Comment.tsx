import {Check, ChevronDown, Reply as ReplyIcon, X} from "lucide-react";
import {memo, useEffect, useLayoutEffect, useRef, useState} from "react";

import {ConfirmDialog, DialogActions, ModalDialog, SubmitForm} from "@/components/dialogs";
import {Button, buttonVariants} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import type {ProcessedComment} from "@/core/preview/comments";
import type {CommentForm, User} from "@/core/preview/types";
import {adminDeleteComments} from "@/core/preview/request";
import {notifyManage} from "@/stores/notify";
import {cn} from "cn";

import {deleteOwnComment} from "../comment-submit";
import {savedNonmember} from "../nonmember";
import {markPressable, pressContents} from "./contentsClick";
import {openDcconInfo} from "./DcconInfoPopup";
import {fitTxtconNearView} from "./fitTxtcon";
import {watchGifVideos} from "./gifVideos";
import {NO_REPLY, parseDate, refreshCommentsOf, usePreviewStore} from "./previewStore";
import {TimeStamp} from "./TimeStamp";
import {UserCard} from "./UserCard";

// 닉콘(a.writer_nikcon img)의 src. 댓글마다 DOMParser를 돌리지 않게 정규식으로 읽는다.
// 디시는 작은따옴표를 쓰지만 따옴표 없는 값도 받는다.
export const extractIcon = (html: string | undefined): string | undefined => html?.match(/writer_nikcon[^>]*>\s*<img\b[^>]*?\ssrc=["']?([^"'\s>]+)/)?.[1];

export const extractIp = (html: string | undefined): string | undefined => html?.match(/class=["']?ip["']?[^>]*>\s*\(([^)]+)\)/)?.[1];

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

/**
 * memo로 감싸 keepUnchanged가 객체를 유지한 댓글은 다시 그리지 않는다.
 * 감싸지 않으면 자동 새로고침·추천·차단 목록 변경마다 댓글 전부를 다시 그린다.
 */
export const Comment = memo(({comment, depth, replyCount, threadOpen, lastReply, isAdmin}: CommentProps) => {
    // reply 객체째 구독하면 답글 버튼 하나에 모든 댓글이 다시 그려지므로, 이 댓글이 대상인지만 구독한다.
    const replying = usePreviewStore((s) => s.reply.replyNo === comment.no);
    const collapsed = usePreviewStore((s) => s.collapsed.has(comment.no));
    const fresh = usePreviewStore((s) => s.freshComments.has(comment.no));
    const toggleCollapse = usePreviewStore((s) => s.toggleCollapse);
    const selected = usePreviewStore((s) => s.selectedComments.has(comment.no));
    const toggleSelected = usePreviewStore((s) => s.toggleSelected);
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
    // 댓글마다 되풀이되는 버튼은 스크린 리더의 버튼 목록에서 구별되게 작성자를 이름에 넣는다 (UserCard가 보여 주는 이름).
    const who = user.nick ?? user.id ?? user.ip;

    const isDeleted = comment.is_delete === "1";
    // 디시처럼 멤버만 댓글(allow_reply)이면 답글도 막고, 답글이 막힌 댓글(reply_w)엔 버튼을 두지 않는다.
    // 음성 댓글은 디시도 reply_w와 상관없이 답글 버튼을 단다.
    // 그린 깊이(depth prop)가 아니라 댓글 자체의 깊이로 본다. 부모를 숨겨 들여쓰지 않은 답글도 답글이다.
    const canReply = !isDeleted && allowReply && (comment.depth > 0 || comment.voice !== undefined || comment.reply_w !== "N");
    const canDelete =
        !isDeleted && (comment.del_btn === "Y" || comment.my_cmt === "Y" || isAdmin || (!comment.user_id && Boolean(comment.ip)));

    // 요청 중에는 X를 막는다. 다시 누르면 같은 삭제가 또 나가 성공 알림 뒤에 실패 알림이 뜬다.
    // 이 댓글이 요청 중인지만 구독한다 (replying과 같은 까닭).
    const deleting = usePreviewStore((s) => s.deletingComments.has(comment.no));

    // 디시콘(img/video)과 글자콘. 답글이면 앞에 멘션이 붙어 오므로 ^로 고정하지 않고 찾는다.
    const isDccon = /<(img|video) class=|<div class="coment_dccon_txt/.test(comment.memo);
    // 정화한 HTML(core/preview/comments.ts)을 그대로 넣는다. 정화 뒤에 고치면(줄바꿈을 <br>로 등) 브라우저가 다른 트리로 읽을 수 있어
    // 글 댓글의 줄바꿈은 CSS(whitespace-pre-line)로 보인다. 붙어 온 디시콘 태그는 splitDccons가 이미 나눴다.
    const html = comment.memo;

    // 글자콘 크기는 그려진 뒤, 화면 근처에 오면 잰다 (fitTxtconNearView). html이 바뀌면 Preact가 내용을 새로 넣으므로 다시 잰다. 글만 있는 댓글(대부분)은 훑지 않는다.
    const body = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (!isDccon) return;
        const stops = Array.from(body.current?.querySelectorAll<HTMLElement>(".coment_dccon_txt") ?? [], (box) => fitTxtconNearView(box));
        return () => {
            for (const stop of stops) stop();
        };
    }, [html, isDccon]);
    // 깨진 디시콘 mp4는 디시처럼 gif로 바꾼다.
    useEffect(() => (isDccon && body.current ? watchGifVideos(body.current) : undefined), [html, isDccon]);
    // 디시콘 정보 창을 키보드로도 연다 (pressContents).
    useEffect(() => {
        if (isDccon && body.current) markPressable(body.current, false);
    }, [html, isDccon]);

    return (
        // 화면 밖 댓글은 레이아웃·스타일 계산을 건너뛴다 (댓글 수백 개인 글을 열 때 크게 준다).
        // 그리지 않은 댓글은 가장 흔한 한 줄 댓글 높이(48px)로 어림한다. 크게 잡으면 답글을 펼칠 때 높이와 스크롤 길이가 부풀었다가 줄어든다.
        <div className={cn("refresher-comment relative px-8 py-2 [contain-intrinsic-size:auto_48px] [content-visibility:auto] hover:bg-muted/50",
                           // 자동 새로고침으로 새로 들어온 댓글 (previewStore의 freshComments). 강조색으로 깔았다가 걷는다.
                           fresh && "animate-fresh-comment",
                           threadOpen && THREAD_OPEN, depth === 1 && REPLY, depth === 1 && !lastReply && REPLY_CONTINUES)}
             data-deleted={isDeleted || undefined} data-blocked={comment.blocked} data-low-activity={comment.lowActivity} data-duplicate={comment.duplicates === 0 || undefined} data-fresh={fresh || undefined}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                    {/* 디시 댓글 목록처럼 관리자는 댓글을 골라 한 번에 지우거나 차단한다 (CommentList의 도구 줄). 지운 댓글은 고를 수 없다. */}
                    {isAdmin && !isDeleted && <Checkbox className="mr-1" aria-label={`${who} 댓글 선택`} checked={selected} onCheckedChange={() => toggleSelected(comment.no)}/>}
                    <UserCard user={user} op={isOp}/>
                    {comment.duplicates ? <span className="text-xs whitespace-nowrap text-muted-foreground">같은 댓글 ×{comment.duplicates}</span> : null}
                    {/* 툴팁은 브라우저 기본(title)을 쓴다. 스레드마다 툴팁 부품을 달면 댓글이 많은 글을 열 때 느려진다. */}
                    {/* 댓글마다 되풀이되는 버튼(접기·답글·삭제)은 Base UI Button 대신 shadcn 버튼 모양(buttonVariants)의 기본 button을 쓴다.
                        Base UI Button은 버튼마다 이벤트 리스너를 여럿 달아 댓글이 천 개면 그것만 8천 개가 넘는다. 기본 button도 키보드·disabled 동작은 같다. */}
                    {/* 펼친 상태는 aria-expanded로 알린다. ghost 버튼이 펼친 상태에 까는 배경은 지워 보이는 모습은 그대로 둔다. */}
                    {depth === 0 && replyCount > 1 && (
                        <button type="button" className={cn(buttonVariants({size: "icon-xs", variant: "ghost", className: "aria-expanded:not-hover:bg-transparent"}))}
                                aria-label={`${who} 댓글의 답글 ${replyCount}개`} aria-expanded={!collapsed}
                                title={collapsed ? "답글 펼치기" : "답글 접기"} onClick={() => toggleCollapse(comment.no)}>
                            <ChevronDown className={cn("transition-transform motion-reduce:transition-none", collapsed && "-rotate-90")}/>
                        </button>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    {canReply && (
                        <button
                            type="button"
                            className={cn(buttonVariants({size: "icon-xs", variant: "ghost", className: replying && "text-link"}))}
                            aria-label={`${who} 댓글에 답글`}
                            aria-pressed={replying}
                            onClick={() =>
                                // 같은 댓글을 다시 누르면 취소한다. 답글의 부모는 스레드 첫 댓글(c_no)이고, 첫 댓글이면 자기 자신이다.
                                usePreviewStore.setState({
                                    reply: replying ? NO_REPLY : {commentNo: comment.depth > 0 ? comment.c_no : comment.no, replyNo: comment.no}
                                })
                            }
                        >
                            {replying ? <Check/> : <ReplyIcon/>}
                        </button>
                    )}
                    {canDelete && (
                        <button type="button" className={cn(buttonVariants({size: "icon-xs", variant: "ghost"}))} aria-label={`${who} 댓글 삭제`} disabled={deleting}
                                onClick={() => usePreviewStore.setState({deletePrompt: {no: comment.no, kind: isAdmin || comment.user_id ? "confirm" : "password"}})}>
                            <X/>
                        </button>
                    )}
                    <TimeStamp date={String(comment.reg_date ?? comment.date_time ?? "")}/>
                </div>
            </div>

            {comment.voice && (
                <div className="mt-1">
                    {comment.voice.iframe ? (
                        <iframe src={comment.voice.src} width={280} height={54} className="block border-0" title="음성 댓글"/>
                    ) : (
                        <audio controls src={comment.voice.src} className="block"/>
                    )}
                </div>
            )}
            {/* 지운 댓글은 읽을 수 있게 본문용 회색을 쓴다. */}
            <div ref={body} className={cn("refresher-html refresher-comment-html mt-1", !isDccon && "whitespace-pre-line", isDeleted && "text-muted-foreground")} data-dccon={isDccon || undefined}
                 onClick={isDccon ? openDcconInfo : undefined}
                 onKeyDown={isDccon ? pressContents : undefined}
                 dangerouslySetInnerHTML={{__html: html}}/>
        </div>
    );
});

const setDeleting = (no: string, deleting: boolean): void =>
    usePreviewStore.setState((s) => {
        const next = new Set(s.deletingComments);
        if (deleting) next.add(no);
        else next.delete(no);
        return {deletingComments: next};
    });

const removeComment = async (no: string, isAdmin: boolean, password: string): Promise<void> => {
    usePreviewStore.setState({deletePrompt: null});
    const st = usePreviewStore.getState();
    if (!st.preData || !st.post) return;
    const signal = st.signalId;

    setDeleting(no, true);
    const request = isAdmin ? adminDeleteComments(st.preData, [no]) : deleteOwnComment(st.preData, st.post, no, password);
    const deleted = await notifyManage(request, "댓글을 삭제했습니다.", "댓글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    // 그새 다른 글로 넘어갔으면 그 글의 상태는 건드리지 않는다 (글을 열면 freshPost가 비운다).
    if (usePreviewStore.getState().signalId === signal) setDeleting(no, false);
    if (deleted) refreshCommentsOf(st.preData);
};

/**
 * 디시의 댓삭튀 차단 경고 (comment.js chk_notice_comment_avoid). 이 규칙을 켠 갤러리는 공지글에 notice_comment_del_avoid를 '1'로 두고,
 * 5분 안에 지운 댓글의 작성자를 매니저 이름으로 차단한다. 차단은 디시 서버가 하므로 미리보기에서 지워도 똑같이 당한다.
 */
export const noticeDeleteWarning = (fields: CommentForm["fields"], date: string): string | undefined => {
    const field = (key: string): string | undefined => fields.find(([name]) => name === key)?.[1];
    if (field("notice_comment_del_avoid") !== "1" || !date || Date.now() - parseDate(date).getTime() >= 5 * 60_000) return undefined;

    return `공지글에 작성한 댓글을 5분 내 삭제 시 매니저에 의해 [${field("notice_comment_del_avoid_msg") ?? ""}] 사유로 차단됩니다.`;
};

/**
 * 댓글 X가 띄운 삭제 확인 창(deletePrompt). CommentList가 한 번만 그린다.
 * 댓글 안에 그리면 답글 수가 1개와 2개 사이를 오갈 때(Thread가 답글을 Collapsible 안팎으로 옮긴다) 그 답글이 새로 마운트되어
 * 창이 말없이 닫히고 입력하던 비밀번호도 사라진다.
 * 비밀번호 없이 지워지는 삭제(관리자·회원 본인)는 X 한 번에 되돌릴 수 없으니 확인한다 (디시 comment.js와 같음). 비밀번호 삭제는 비밀번호 창이 확인을 겸한다.
 */
export const CommentDeletePrompt = ({comments, isAdmin}: { comments: ProcessedComment[]; isAdmin: boolean }) => {
    const prompt = usePreviewStore((s) => s.deletePrompt);
    const fields = usePreviewStore((s) => s.post?.commentForm.fields);
    const target = prompt ? comments.find((comment) => comment.no === prompt.no && comment.is_delete !== "1") : undefined;
    // 새로고침으로 대상이 사라졌거나 이미 지워졌으면 창을 닫는다. 두면 같은 번호가 다시 보일 때 창이 저절로 뜬다.
    const gone = prompt !== null && !target;
    useEffect(() => {
        if (gone) usePreviewStore.setState({deletePrompt: null});
    }, [gone]);
    if (!prompt || !target) return null;

    const close = (): void => usePreviewStore.setState({deletePrompt: null});
    // 관리자 삭제는 남의 댓글을 지우는 것이라 차단 대상이 아니다.
    const warning = isAdmin || !fields ? undefined : noticeDeleteWarning(fields, String(target.reg_date ?? target.date_time ?? ""));
    return prompt.kind === "confirm" ? (
        <ConfirmDialog title={warning ? `${warning} 댓글을 삭제할까요?` : "댓글을 삭제할까요?"} confirmLabel="삭제" danger
                       onConfirm={() => void removeComment(target.no, isAdmin, "")} onClose={close}/>
    ) : (
        <PasswordDialog warning={warning} onSubmit={(password) => void removeComment(target.no, isAdmin, password)} onClose={close}/>
    );
};

/**
 * 유동 댓글을 지울 비밀번호를 묻는다. 미리보기에서 쓴 댓글은 저장해 둔 비밀번호를 썼으므로 비워 두면 그것을 쓴다.
 * 저장된 비밀번호는 칸에 채우지 않는다 (WriteComment와 같은 까닭).
 */
const PasswordDialog = ({warning, onSubmit, onClose}: { warning?: string; onSubmit: (password: string) => void; onClose: () => void }) => {
    const [saved] = useState(() => savedNonmember().pw);
    const [password, setPassword] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const value = password || saved;

    return (
        <ModalDialog onClose={onClose} className="sm:max-w-[320px]" focusOnOpen={input}>
            <DialogHeader>
                <DialogTitle>댓글 비밀번호</DialogTitle>
                {warning && <p className="text-sm text-destructive">{warning}</p>}
            </DialogHeader>
            <SubmitForm onSubmit={() => value && onSubmit(value)} className="flex flex-col gap-4">
                <Input
                    ref={input}
                    type="password"
                    value={password}
                    aria-label="댓글 비밀번호"
                    placeholder={saved ? "비밀번호 (저장됨)" : "비밀번호"}
                    onChange={(ev) => setPassword(ev.target.value)}
                />
                <DialogActions>
                    <Button type="submit" variant="destructive" disabled={!value}>삭제</Button>
                </DialogActions>
            </SubmitForm>
        </ModalDialog>
    );
};
