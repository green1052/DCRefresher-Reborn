import {Fragment} from "react";

import {Collapsible, CollapsibleContent} from "@/components/ui/collapsible";
import type {ProcessedComment} from "@/core/preview/comments";
import {useUiStore} from "@/stores/ui";
import {isGalleryManager} from "@/utils/user";

import {Comment} from "./Comment";
import {usePreviewStore} from "./previewStore";

/** 스레드 첫 댓글로 그릴 댓글. 10쪽 제한으로 부모를 받지 못한 답글도 넣는다. 빠뜨리면 머리의 스레드·총 댓글 수와 어긋난다. */
export const threadParents = (comments: ProcessedComment[]): ProcessedComment[] => {
    const topNos = new Set(comments.filter((comment) => comment.depth === 0).map((comment) => comment.no));
    return comments.filter((comment) => comment.depth === 0 || !topNos.has(comment.c_no));
};

/**
 * 스레드 하나(첫 댓글과 접을 수 있는 답글). 접힘은 스레드마다 구독한다. 목록 전체가 구독하면 하나를 접을 때마다 댓글 전부를 다시 그린다.
 */
const Thread = ({parent, replies, isAdmin}: { parent: ProcessedComment; replies: ProcessedComment[]; isAdmin: boolean }) => {
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
};

/** 스레드별 댓글과 접을 수 있는 답글. */
export const CommentList = () => {
    const comments = usePreviewStore((s) => s.comments)!;
    const revealed = useUiStore((s) => s.blockView?.revealed === true);

    // 숨김 차단과 접힌 같은 댓글은 '가린 내용 보기' 동안만 (흐리게) 그린다. 블러 차단은 그려 두고 features/preview/overlay.css가 흐린다.
    // 트리 선과 답글 수도 그리는 댓글만 센다.
    const shown = new Set(revealed ? comments : comments.filter((comment) => comment.blocked !== "hide" && comment.duplicates !== 0));
    const parents = threadParents(comments);
    // 답글을 스레드 첫 댓글 번호(c_no)로 한 번에 묶는다. 부모마다 전체를 훑으면 O(n²)이다.
    const repliesOf = Map.groupBy(comments.filter((comment) => comment.depth === 1 && shown.has(comment)), (comment) => comment.c_no);
    // 문서를 querySelector로 훑으므로 댓글마다가 아니라 여기서 한 번 잰다.
    // 모듈 전역에 두면 페이지를 다 읽기 전에 잰 false가 굳는다.
    const isAdmin = isGalleryManager();

    return (
        <div className="py-1">
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

                return <Thread key={parent.no} parent={parent} replies={replies} isAdmin={isAdmin}/>;
            })}
        </div>
    );
};
