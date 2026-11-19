import {Ban, Trash2} from "lucide-preact";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { memo } from "@/utils/memo";
import { Fragment, type TargetedMouseEvent as MouseEvent } from "preact";

import {ConfirmDialog} from "@/components/dialogs";
import {useCollapse} from "@/components/useCollapse";
import type {ProcessedComment} from "@/core/preview/comments";
import {adminDeleteComments} from "@/core/preview/request";
import {cn} from "cn";
import {useUiStore} from "@/stores/ui";
import {eventTarget, isTyping} from "@/utils/event";
import {isGalleryManager} from "@/utils/user";

import {Comment, CommentDeletePrompt, notifyDeleted} from "./Comment";
import {type CommentOrderValue, NO_FRESH, usePreviewStore} from "./previewStore";

/** 처음 그리는 스레드 수와 그린 뒤마다 더 그리는 수 (CommentList). 처음 것은 창 한두 화면을 채운다. */
const FIRST_THREADS = 60;
const MORE_THREADS = 150;

/** 스레드 첫 댓글(부모를 받지 못한 답글 포함 - 빠뜨리면 머리 수와 어긋난다). 최신순은 스레드를 거꾸로, 답글순은 답글 많은 순. */
export const threadParents = (comments: ProcessedComment[], order: CommentOrderValue = "oldest"): ProcessedComment[] => {
    const topNos = new Set(comments.filter((comment) => comment.depth === 0).map((comment) => comment.no));
    const parents = comments.filter((comment) => comment.depth === 0 || !topNos.has(comment.c_no));
    if (order === "newest") return parents.reverse();
    if (order === "replies") {
        // 부모를 받지 못한 답글은 c_no가 다른 스레드의 번호라 세지 않는다 (topNos에 없다).
        const replies = Map.groupBy(comments.filter((comment) => comment.depth === 1 && topNos.has(comment.c_no)), (comment) => comment.c_no);
        const count = (parent: ProcessedComment): number => parent.depth === 0 ? replies.get(parent.no)?.length ?? 0 : 0;
        return parents.toSorted((a, b) => count(b) - count(a));
    }
    return parents;
};

/** 댓글 머리의 개수 요약. hidden은 가린 댓글 수(차단, 깡계, 접은 같은 댓글)로, 0이 아닌 것만 적고 없으면 빈 글자다. */
export const summaryOf = (comments: ProcessedComment[]): { counts: string; hidden: string } => {
    const blocked = comments.filter((comment) => comment.blocked && !comment.lowActivity).length;
    const lowActivity = comments.filter((comment) => comment.lowActivity).length;
    const folded = comments.filter((comment) => comment.duplicates === 0).length;
    return {
        counts: `스레드 ${threadParents(comments).length}개, 총 댓글 ${comments.length}개`,
        hidden: [blocked && `차단 ${blocked}개`, lowActivity && `깡계 ${lowActivity}개`, folded && `같은 댓글 ${folded}개 접음`].filter(Boolean).join(", ")
    };
};

/** 개수 요약 - 가린 댓글이 있으면 이 글에서만 펼쳐 보는 버튼을 단다(페이지 전역 공개 중엔 달지 않는다). */
export const CommentSummary = ({comments}: { comments: ProcessedComment[] }) => {
    const pageRevealed = useUiStore((s) => s.blockRevealed);
    const revealed = usePreviewStore((s) => s.commentsRevealed);
    const {counts, hidden} = summaryOf(comments);

    return (
        <span className="text-base-content/60">
            {hidden ? `${counts} (${hidden})` : counts}
            {hidden && !pageRevealed && (
                <button type="button" className="ml-1.5 align-baseline text-sm text-link underline-offset-4 hover:underline"
                        onClick={() => usePreviewStore.setState({commentsRevealed: !revealed})}>
                    {revealed ? "다시 숨기기" : "가린 댓글 보기"}
                </button>
            )}
        </span>
    );
};

const ORDER_NAMES: Record<CommentOrderValue, string> = {oldest: "등록순", newest: "최신순", replies: "답글순"};

/** 댓글 머리의 등록순, 최신순, 답글순 고르기. 순서는 여기와 CommentList만 구독한다. Frame이 구독하면 고를 때마다 본문까지 다시 그린다. */
export const CommentOrder = () => {
    const order = usePreviewStore((s) => s.commentOrder);

    return (
        <div role="group" aria-label="댓글 순서" className="join">
            {(Object.keys(ORDER_NAMES) as CommentOrderValue[]).map((value) => (
                <button key={value} type="button" aria-pressed={order === value}
                        className={cn("btn btn-outline btn-xs join-item h-6 min-w-0 px-2 text-xs", order === value && "btn-active")}
                        onClick={() => usePreviewStore.setState({commentOrder: value})}>
                    {ORDER_NAMES[value]}
                </button>
            ))}
        </div>
    );
};

/** 답글 없는 스레드의 replies. 렌더마다 새 []를 주면 Thread의 memo가 매번 빗나간다. */
const NO_REPLIES: ProcessedComment[] = [];

/** 스레드 하나 - 접힘은 스레드마다, memo로 이미 그린 스레드는 건너뛴다(목록 전체가 구독하면 전부 다시 그린다). */
const Thread = memo(({parent, replies, isAdmin}: { parent: ProcessedComment; replies: ProcessedComment[]; isAdmin: boolean }) => {
    // 펼치기 버튼은 답글이 둘 이상일 때만 있다. 접은 뒤 답글이 하나로 줄면(삭제, 차단) 펼칠 수 없게 갇히므로 펼쳐 둔다.
    const isCollapsed = usePreviewStore((s) => replies.length > 1 && s.collapsed.has(parent.no));
    const collapse = useCollapse(!isCollapsed);

    const children = replies.map((child, index) => (
        <Comment key={child.no} comment={child} depth={1} replyCount={0} lastReply={index === replies.length - 1} isAdmin={isAdmin}/>
    ));

    return (
        <>
            <Comment comment={parent} depth={0} replyCount={replies.length} threadOpen={!isCollapsed && replies.length > 0} isAdmin={isAdmin}/>
            {/* 접고 펼 때 높이를 움직인다 - 답글 하나는 Collapsible 없이(그릴 때마다 높이를 재 느리다). */}
            {replies.length > 1 ? (
                collapse.render && (
                    <div ref={collapse.ref} style={collapse.style} onTransitionEnd={collapse.onTransitionEnd}
                         className="overflow-clip transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none">
                        {children}
                    </div>
                )
            ) : children}
        </>
    );
});

/** 관리자가 고른 댓글을 한 번에 지우거나 차단한다 - 고른 것과 접힘은 따로 구독한다(목록이 구독하면 전부 다시 그린다). */
const SelectionTools = ({shownSelectable, foldable}: { shownSelectable: ProcessedComment[]; foldable: ReadonlySet<string> }) => {
    const collapsed = usePreviewStore((s) => s.collapsed);
    const selectable = shownSelectable.filter((comment) => !(comment.depth === 1 && foldable.has(comment.c_no) && collapsed.has(comment.c_no)));
    const selected = usePreviewStore((s) => s.selectedComments);
    const picked = selectable.filter((comment) => selected.has(comment.no)).map((comment) => comment.no);
    const all = picked.length > 0 && picked.length === selectable.length;
    const id = useId();
    const allBox = useRef<HTMLInputElement>(null);
    useLayoutEffect(() => {
        // indeterminate는 속성이 아니라 프로퍼티로만 정한다.
        if (allBox.current) allBox.current.indeterminate = picked.length > 0 && !all;
    });
    const [confirming, setConfirming] = useState(false);
    // 요청 중에는 삭제를 막는다. 다시 누르면 같은 삭제가 또 나가 성공 알림 뒤에 실패 알림이 뜬다 (Comment.tsx와 같음).
    const [deleting, setDeleting] = useState(false);

    const remove = async (): Promise<void> => {
        setConfirming(false);
        const st = usePreviewStore.getState();
        if (!st.preData) return;
        const signal = st.signalId;
        setDeleting(true);
        const deleted = await notifyDeleted(st.preData, adminDeleteComments(st.preData, picked));
        setDeleting(false);
        // 그새 다른 글로 넘어갔으면 그 글의 고른 댓글은 건드리지 않는다.
        if (deleted && usePreviewStore.getState().signalId === signal) usePreviewStore.setState({selectedComments: NO_FRESH});
    };

    return (
        <div className="flex items-center gap-2 px-8 py-1">
            <div className="flex w-auto items-center gap-3">
                <input ref={allBox} type="checkbox" id={id} className="checkbox" checked={all}
                       onChange={() => usePreviewStore.setState({selectedComments: all ? NO_FRESH : new Set(selectable.map((comment) => comment.no))})}/>
                <label htmlFor={id} className="text-sm font-normal leading-snug">전체 선택</label>
            </div>
            {picked.length > 0 && <span className="text-xs text-base-content/60">{picked.length}개 선택</span>}
            <div className="ml-auto flex gap-1">
                <button type="button" className="btn btn-error btn-xs" disabled={picked.length === 0 || deleting} onClick={() => setConfirming(true)}>
                    <Trash2 className="size-3"/>삭제
                </button>
                {/* 창을 여는 순간 고른 것을 지금 보이는 댓글로 좁힌다. 차단 창은 selectedComments를 그대로 보낸다. */}
                <button type="button" className="btn btn-error btn-xs" disabled={picked.length === 0}
                        onClick={() => usePreviewStore.setState({selectedComments: new Set(picked), blockPopup: "comments"})}>
                    <Ban className="size-3"/>차단
                </button>
            </div>
            {/* 미리보기 창 안에 그려 확인 창을 누를 때 미리보기가 바깥 클릭으로 닫히지 않는다. */}
            {confirming && (
                <ConfirmDialog title={`선택한 댓글 ${picked.length}개를 삭제할까요?`} confirmLabel="삭제" danger
                               onConfirm={() => void remove()} onClose={() => setConfirming(false)}/>
            )}
        </div>
    );
};

/** 답글을 c_no로 한 번에 묶는다(부모마다 훑으면 O(n²)) - 앞 묶음을 재사용해 memo한 Thread가 건너뛰게 한다. */
export const groupReplies = (replies: ProcessedComment[], prev?: ReadonlyMap<string, ProcessedComment[]>): Map<string, ProcessedComment[]> => {
    const grouped = Map.groupBy(replies, (comment) => comment.c_no);
    for (const [no, group] of grouped) {
        const old = prev?.get(no);
        if (old?.length === group.length && group.every((comment, index) => comment === old[index])) grouped.set(no, old);
    }
    return grouped;
};

/** 멘션(@닉(IP))이 가리키는 댓글 - 답글의 멘션은 누른 댓글보다 앞선 같은 작성자의 최근 댓글이다. */
export const mentionTarget = (comments: ProcessedComment[], from: string, mention: string): ProcessedComment | undefined => {
    const [, nick, ip] = mention.match(/^@(.+?)(?:\(([^()]*)\))?$/) ?? [];
    if (nick === undefined) return undefined;
    const fromIndex = comments.findIndex((comment) => comment.no === from);
    for (let i = (fromIndex === -1 ? comments.length : fromIndex) - 1; i >= 0; i--) {
        const comment = comments[i]!;
        if (comment.name === nick && (ip ? comment.ip === ip : comment.user_id)) return comment;
    }
    return undefined;
};

/** 스레드별 댓글과 접을 수 있는 답글. */
export const CommentList = ({comments}: { comments: ProcessedComment[] }) => {
    const pageRevealed = useUiStore((s) => s.blockRevealed);
    const postRevealed = usePreviewStore((s) => s.commentsRevealed);
    const revealed = pageRevealed || postRevealed;
    const order = usePreviewStore((s) => s.commentOrder);

    // 숨김 차단, 접힌 같은 댓글은 공개 동안만 그린다(블러는 그려 두고 overlay.css가 흐린다). 답글 배열은 useMemo로 유지해 memo가 살게 한다.
    const lastReplies = useRef<Map<string, ProcessedComment[]>>(undefined);
    const {shown, parents, repliesOf} = useMemo(() => {
        const shown = new Set(revealed ? comments : comments.filter((comment) => comment.blocked !== "hide" && comment.duplicates !== 0));
        lastReplies.current = groupReplies(comments.filter((comment) => comment.depth === 1 && shown.has(comment)), lastReplies.current);
        return {shown, parents: threadParents(comments, order), repliesOf: lastReplies.current};
    }, [comments, revealed, order]);
    // 문서를 querySelector로 훑으므로 여기서 한 번만 잰다(전역에 두면 읽기 전 false가 굳는다).
    const isAdmin = isGalleryManager();

    // 스레드가 많으면 처음엔 일부만 - 천 개를 한 번에 그리면 창이 멈춘다.
    const [limit, setLimit] = useState(FIRST_THREADS);
    // 답글 버튼을 눌렀으면 입력칸이 밀리지 않게 전부 그린 채로 데려간다.
    const replying = usePreviewStore((s) => s.reply.replyNo !== null);
    const count = replying ? Infinity : limit;
    useEffect(() => {
        if (replying) setLimit(Infinity);
    }, [replying]);
    // 더 그리기는 그린 것을 화면에 낸 뒤(useEffect)에 건다.
    useEffect(() => {
        if (count >= parents.length) return;
        const timer = window.setTimeout(() => setLimit((current) => current + MORE_THREADS));
        return () => window.clearTimeout(timer);
    }, [count, parents.length]);
    // 다 그리기 전에 누른 End는 다 그린 뒤 직접 끝으로 굴린다(파이어폭스는 받은 때의 높이로 끝을 정한다). 캡처: 다이얼로그가 전파를 멈춘다.
    const unfinished = count < parents.length;
    const endScroller = useRef<Element | null>(null);
    useLayoutEffect(() => {
        if (!unfinished) return;
        const onKey = (ev: KeyboardEvent): void => {
            if (ev.key !== "End" || isTyping(ev)) return;
            const target = eventTarget(ev);
            const scroller = target instanceof Element ? target.closest(".refresher-frame-scroll") : null;
            if (scroller) {
                ev.preventDefault();
                endScroller.current = scroller;
            }
            setLimit(Infinity);
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [unfinished]);
    useLayoutEffect(() => {
        const scroller = endScroller.current;
        if (unfinished || !scroller) return;
        endScroller.current = null;
        // 바로 옮긴다. 부드럽게 굴리면 지나는 댓글이 어림 높이(48px)에서 실제 높이로 바뀌며 끝이 멀어져 도중에 멈춘다.
        scroller.scrollTop = scroller.scrollHeight;
    }, [unfinished]);

    // 멘션(@닉(IP))을 누르면 가리키는 댓글로 간다. 목록 전체를 아는 곳이 여기뿐이고 댓글마다 data-no가 있어 위임으로 받는다.
    const root = useRef<HTMLDivElement>(null);
    const jumpMention = (ev: MouseEvent<HTMLDivElement>): void => {
        const anchor = ev.target instanceof Element ? ev.target.closest("a.mention") : null;
        if (!anchor) return;
        const from = anchor.closest("[data-no]")?.getAttribute("data-no") ?? "";
        const target = mentionTarget(comments, from, anchor.textContent?.trim() ?? "");
        // 숨김 차단 등으로 그리지 않은 댓글로는 갈 수 없다.
        if (!target || !shown.has(target)) return;

        // 접힌 답글이면 펼치고, 아직 그리지 않았으면 다 그린다(End 키와 같다).
        if (target.depth > 0 && (repliesOf.get(target.c_no)?.length ?? 0) > 1 && usePreviewStore.getState().collapsed.has(target.c_no)) {
            usePreviewStore.getState().toggleCollapse(target.c_no);
        }
        if (parents.findIndex((p) => p.no === target.no || p.no === target.c_no) >= count) setLimit(Infinity);

        // 펼치고 더 그린 뒤 찾는다 - 부드러운 굴림은 어림 높이가 실제로 바뀌며 도중에 멈춘다.
        let tries = 0;
        const step = (): void => {
            const el = root.current?.querySelector(`[data-no="${CSS.escape(target.no)}"]`);
            if (!el) {
                if (++tries < 60) requestAnimationFrame(step);
                return;
            }
            el.scrollIntoView({block: "center"});
            el.classList.add("animate-fresh-comment");
            el.addEventListener("animationend", () => el.classList.remove("animate-fresh-comment"), {once: true});
        };
        requestAnimationFrame(step);
    };

    return (
        <div className="py-1" ref={root} onClick={jumpMention} data-comments-revealed={postRevealed || undefined}>
            {isAdmin && (
                <SelectionTools shownSelectable={comments.filter((comment) => shown.has(comment) && comment.is_delete !== "1")}
                                foldable={new Set(parents.filter((parent) => shown.has(parent) && (repliesOf.get(parent.no)?.length ?? 0) > 1).map((parent) => parent.no))}/>
            )}
            {parents.slice(0, count).map((parent) => {
                const replies = repliesOf.get(parent.no) ?? NO_REPLIES;

                // 부모를 숨겼으면 답글을 들여쓰지 않고 그 자리에 그린다. 이어 줄 트리 선이 없다.
                if (!shown.has(parent)) {
                    return (
                        <Fragment key={parent.no}>
                            {replies.map((child) => <Comment key={child.no} comment={child} depth={0} replyCount={0} isAdmin={isAdmin}/>)}
                        </Fragment>
                    );
                }

                return <Thread key={parent.no} parent={parent} replies={replies} isAdmin={isAdmin}/>;
            })}
            {/* SelectionTools의 확인 창처럼 미리보기 창 안에 그린다. 댓글마다 그리지 않는 까닭은 CommentDeletePrompt에 있다. */}
            <CommentDeletePrompt comments={comments} isAdmin={isAdmin}/>
        </div>
    );
};
