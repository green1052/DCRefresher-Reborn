import {Ban, Trash2} from "lucide-react";
import {Fragment, memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent} from "react";

import {ConfirmDialog} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {Collapsible, CollapsibleContent} from "@/components/ui/collapsible";
import {Field, FieldLabel} from "@/components/ui/field";
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group";
import type {ProcessedComment} from "@/core/preview/comments";
import {adminDeleteComments} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";
import {eventTarget, isTyping} from "@/utils/event";
import {isGalleryManager} from "@/utils/user";

import {Comment, CommentDeletePrompt, notifyDeleted} from "./Comment";
import {type CommentOrderValue, NO_FRESH, usePreviewStore} from "./previewStore";

/** 처음 그리는 스레드 수와 그린 뒤마다 더 그리는 수 (CommentList). 처음 것은 창 한두 화면을 채운다. */
const FIRST_THREADS = 60;
const MORE_THREADS = 150;

/**
 * 스레드 첫 댓글로 그릴 댓글. 10쪽 제한으로 부모를 받지 못한 답글도 넣는다. 빠뜨리면 머리의 스레드·총 댓글 수와 어긋난다.
 * 댓글은 번호(등록)순이다. 최신순은 스레드만 거꾸로, 답글순은 답글이 많은 스레드부터(같으면 등록순) 세운다.
 * 답글은 어느 순서든 첫 댓글 아래에 등록순으로 남는다 (디시 본문의 최신순·답글순과 같다).
 */
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

/** 댓글 머리의 개수 요약. hidden은 가린 댓글 수(차단·깡계·접은 같은 댓글)로, 0이 아닌 것만 적고 없으면 빈 글자다. */
export const summaryOf = (comments: ProcessedComment[]): { counts: string; hidden: string } => {
    const blocked = comments.filter((comment) => comment.blocked && !comment.lowActivity).length;
    const lowActivity = comments.filter((comment) => comment.lowActivity).length;
    const folded = comments.filter((comment) => comment.duplicates === 0).length;
    return {
        counts: `스레드 ${threadParents(comments).length}개, 총 댓글 ${comments.length}개`,
        hidden: [blocked && `차단 ${blocked}개`, lowActivity && `깡계 ${lowActivity}개`, folded && `같은 댓글 ${folded}개 접음`].filter(Boolean).join(", ")
    };
};

/**
 * 댓글 머리의 개수 요약. 가린 댓글이 있으면 이 글에서만 펼쳐 보는 버튼을 단다. 페이지의 '가린 내용 보기' 중이면 이미 다 보이므로 달지 않는다.
 * 펼침은 여기와 CommentList만 구독한다 (CommentOrder와 같은 까닭).
 */
export const CommentSummary = ({comments}: { comments: ProcessedComment[] }) => {
    const pageRevealed = useUiStore((s) => s.blockRevealed);
    const revealed = usePreviewStore((s) => s.commentsRevealed);
    const {counts, hidden} = summaryOf(comments);

    return (
        <span className="text-muted-foreground">
            {hidden ? `${counts} (${hidden})` : counts}
            {hidden && !pageRevealed && (
                <Button variant="link" size="xs" className="ml-1.5 h-auto p-0 align-baseline text-sm text-link"
                        onClick={() => usePreviewStore.setState({commentsRevealed: !revealed})}>
                    {revealed ? "다시 숨기기" : "가린 댓글 보기"}
                </Button>
            )}
        </span>
    );
};

const ORDER_NAMES: Record<CommentOrderValue, string> = {oldest: "등록순", newest: "최신순", replies: "답글순"};
const isOrder = (value: string | undefined): value is CommentOrderValue => value !== undefined && value in ORDER_NAMES;

/** 댓글 머리의 등록순·최신순·답글순 고르기. 순서는 여기와 CommentList만 구독한다. Frame이 구독하면 고를 때마다 본문까지 다시 그린다. */
export const CommentOrder = () => {
    const order = usePreviewStore((s) => s.commentOrder);

    return (
        <ToggleGroup aria-label="댓글 순서" variant="outline" spacing={0} value={[order]} onValueChange={([value]) => {
            // 이미 고른 것을 다시 누르면 빈 값이 온다. 그대로 둔다.
            if (isOrder(value)) usePreviewStore.setState({commentOrder: value});
        }}>
            {Object.entries(ORDER_NAMES).map(([value, name]) => <ToggleGroupItem key={value} value={value} className="h-6 min-w-0 px-2 text-xs">{name}</ToggleGroupItem>)}
        </ToggleGroup>
    );
};

/** 답글 없는 스레드의 replies. 렌더마다 새 []를 주면 Thread의 memo가 매번 빗나간다. */
const NO_REPLIES: ProcessedComment[] = [];

/**
 * 스레드 하나(첫 댓글과 접을 수 있는 답글). 접힘은 스레드마다 구독한다. 목록 전체가 구독하면 하나를 접을 때마다 댓글 전부를 다시 그린다.
 * memo로 감싸 목록이 스레드를 더 그릴 때 이미 그린 스레드(Collapsible이 높이를 다시 잰다)는 건너뛴다. replies는 목록이 useMemo로 유지한다.
 */
const Thread = memo(({parent, replies, isAdmin}: { parent: ProcessedComment; replies: ProcessedComment[]; isAdmin: boolean }) => {
    // 펼치기 버튼은 답글이 둘 이상일 때만 있다. 접은 뒤 답글이 하나로 줄면(삭제·차단) 펼칠 수 없게 갇히므로 펼쳐 둔다.
    const isCollapsed = usePreviewStore((s) => replies.length > 1 && s.collapsed.has(parent.no));

    const children = replies.map((child, index) => (
        <Comment key={child.no} comment={child} depth={1} replyCount={0} lastReply={index === replies.length - 1} isAdmin={isAdmin}/>
    ));

    return (
        <>
            <Comment comment={parent} depth={0} replyCount={replies.length} threadOpen={!isCollapsed && replies.length > 0} isAdmin={isAdmin}/>
            {/* 접고 펼 때 높이를 움직인다. 처음 그릴 때는 애니메이션을 건너뛴다.
                접기 버튼은 답글이 둘 이상일 때만 있으므로 답글 하나는 Collapsible 없이 그린다. Collapsible은 그릴 때마다 높이와 스타일을 재 스레드가 많은 글에서 느리다. */}
            {replies.length > 1 ? (
                <Collapsible open={!isCollapsed}>
                    <CollapsibleContent
                        className="h-(--collapsible-panel-height) overflow-clip transition-[height,opacity] duration-200 ease-out data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
                        {children}
                    </CollapsibleContent>
                </Collapsible>
            ) : children}
        </>
    );
});

/**
 * 관리자가 고른 댓글을 한 번에 지우거나 작성자를 차단한다 (디시 댓글 목록 아래의 댓글 삭제·차단 버튼).
 * 고른 것과 접힘은 따로 구독한다. 목록이 구독하면 하나를 고르거나 접을 때마다 댓글 전부를 다시 그린다.
 * shownSelectable: 보이고 지우지 않은 댓글. 새로고침으로 사라진 댓글은 골라 두었어도 세지 않는다.
 * foldable: 답글을 접을 수 있는 스레드의 첫 댓글 번호. 접힌 스레드의 답글은 체크박스가 그려지지 않으므로 고르지 않는다.
 */
const SelectionTools = ({shownSelectable, foldable}: { shownSelectable: ProcessedComment[]; foldable: ReadonlySet<string> }) => {
    const collapsed = usePreviewStore((s) => s.collapsed);
    const selectable = shownSelectable.filter((comment) => !(comment.depth === 1 && foldable.has(comment.c_no) && collapsed.has(comment.c_no)));
    const selected = usePreviewStore((s) => s.selectedComments);
    const picked = selectable.filter((comment) => selected.has(comment.no)).map((comment) => comment.no);
    const all = picked.length > 0 && picked.length === selectable.length;
    const id = useId();
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
            <Field orientation="horizontal" className="w-auto">
                <Checkbox id={id} checked={all} indeterminate={picked.length > 0 && !all}
                          onCheckedChange={() => usePreviewStore.setState({selectedComments: all ? NO_FRESH : new Set(selectable.map((comment) => comment.no))})}/>
                <FieldLabel htmlFor={id} className="font-normal">전체 선택</FieldLabel>
            </Field>
            {picked.length > 0 && <span className="text-xs text-muted-foreground">{picked.length}개 선택</span>}
            <div className="ml-auto flex gap-1">
                <Button size="xs" variant="destructive" disabled={picked.length === 0 || deleting} onClick={() => setConfirming(true)}>
                    <Trash2 data-icon="inline-start"/>삭제
                </Button>
                {/* 창을 여는 순간 고른 것을 지금 보이는 댓글로 좁힌다. 차단 창은 selectedComments를 그대로 보낸다. */}
                <Button size="xs" variant="destructive" disabled={picked.length === 0}
                        onClick={() => usePreviewStore.setState({selectedComments: new Set(picked), blockPopup: "comments"})}>
                    <Ban data-icon="inline-start"/>차단
                </Button>
            </div>
            {/* 미리보기 창 안에 그려 확인 창을 누를 때 미리보기가 바깥 클릭으로 닫히지 않는다. */}
            {confirming && (
                <ConfirmDialog title={`선택한 댓글 ${picked.length}개를 삭제할까요?`} confirmLabel="삭제" danger
                               onConfirm={() => void remove()} onClose={() => setConfirming(false)}/>
            )}
        </div>
    );
};

/**
 * 답글을 스레드 첫 댓글 번호(c_no)로 한 번에 묶는다. 부모마다 전체를 훑으면 O(n²)이다.
 * 앞서 묶은 것(prev)과 답글이 그대로인 스레드는 그 배열을 다시 써 memo한 Thread가 건너뛰게 한다.
 * 새로고침은 바뀐 댓글만 새 객체로 주므로(processKeepingUnchanged) 댓글 하나가 바뀌어도 나머지 스레드는 다시 그리지 않는다.
 */
export const groupReplies = (replies: ProcessedComment[], prev?: ReadonlyMap<string, ProcessedComment[]>): Map<string, ProcessedComment[]> => {
    const grouped = Map.groupBy(replies, (comment) => comment.c_no);
    for (const [no, group] of grouped) {
        const old = prev?.get(no);
        if (old?.length === group.length && group.every((comment, index) => comment === old[index])) grouped.set(no, old);
    }
    return grouped;
};

/**
 * 멘션 문자열(@닉(IP) 또는 회원 @닉)이 가리키는 댓글. 답글의 멘션은 누른 댓글보다 앞선 같은 작성자의 가장 최근 댓글이다.
 * 유동은 항상 (IP)가 붙어 오고, 회원 멘션(@닉)은 같은 닉의 회원 댓글에만 맞춘다 (유동으로 엉뚱하게 가지 않게).
 */
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

    // 숨김 차단(깡계 숨기기 포함)과 접힌 같은 댓글은 '가린 내용 보기'나 이 글에서 가린 댓글 보기 동안만 (흐리게) 그린다. 블러 차단은 그려 두고 features/preview/overlay.css가 흐린다.
    // 트리 선과 답글 수도 그리는 댓글만 센다.
    // 스레드를 나눠 그리는 동안(아래 limit)과 댓글을 새로고침할 때 답글 배열이 그대로여야 memo한 Thread가 다시 그려지지 않으므로 useMemo로 두고 앞 묶음을 넘긴다.
    const lastReplies = useRef<Map<string, ProcessedComment[]>>(undefined);
    const {shown, parents, repliesOf} = useMemo(() => {
        const shown = new Set(revealed ? comments : comments.filter((comment) => comment.blocked !== "hide" && comment.duplicates !== 0));
        lastReplies.current = groupReplies(comments.filter((comment) => comment.depth === 1 && shown.has(comment)), lastReplies.current);
        return {shown, parents: threadParents(comments, order), repliesOf: lastReplies.current};
    }, [comments, revealed, order]);
    // 문서를 querySelector로 훑으므로 댓글마다가 아니라 여기서 한 번 잰다.
    // 모듈 전역에 두면 페이지를 다 읽기 전에 잰 false가 굳는다.
    const isAdmin = isGalleryManager();

    // 스레드가 많으면 처음엔 앞의 일부만 그리고 그린 뒤마다 더 그린다. 천 개를 한 번에 그리면 수백 ms 동안 창이 멈춘다.
    // 개수 요약·전체 선택·삭제 창은 DOM이 아니라 comments를 보므로 다 그리기 전에도 맞다.
    const [limit, setLimit] = useState(FIRST_THREADS);
    // 답글 버튼은 맨 아래 입력칸으로 데려간다. 그 뒤에 위에서 댓글이 늘면 입력칸이 밀려 내려가므로 다 그린 채로 데려간다.
    // 답글을 취소해도 다시 줄이지 않는다.
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
    // 다 그리기 전에 누른 End는 다 그린 뒤 직접 끝으로 굴린다. 기본 동작에 맡기면 파이어폭스는 키를 받은 때의 높이로 끝을 정해 그때까지 그린 끝에 멈춘다.
    // 그리자마자 누른 키도 받게 useLayoutEffect로 건다. 캡처로 받는다: Base UI 다이얼로그(창)가 화살표·Home·End의 전파를 멈춰 window까지 올라오지 않는다.
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

        // 펼치고 더 그린 뒤에 찾는다 (몇 프레임 걸릴 수 있다). 바로 굴린다: 지나는 댓글이 어림 높이에서 실제 높이로 바뀌며 부드러운 굴림이 도중에 멈춘다.
        // 강조는 새 댓글(freshComments)과 같은 깜빡임을 쓴다.
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
