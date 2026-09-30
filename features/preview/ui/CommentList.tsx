import {Box} from "@radix-ui/themes";
import {Collapsible} from "radix-ui";
import {Fragment, useDeferredValue} from "react";

import type {ProcessedComment} from "@/core/preview/comments";
import {useUiStore} from "@/stores/ui";
import {isGalleryManager} from "@/utils/user";

import {Comment} from "./Comment";
import {usePreviewStore} from "./previewStore";

const NO_COMMENTS: ProcessedComment[] = [];

/** 스레드 첫 댓글로 그릴 댓글. 10쪽 제한으로 부모를 받지 못한 답글도 넣는다. 빠뜨리면 머리의 스레드·총 댓글 수와 어긋난다 */
export const threadParents = (comments: ProcessedComment[]): ProcessedComment[] => {
    const topNos = new Set(comments.filter((comment) => comment.depth === 0).map((comment) => comment.no));
    return comments.filter((comment) => comment.depth === 0 || !topNos.has(comment.c_no));
};

/** 스레드별 댓글과 접을 수 있는 답글 */
export const CommentList = () => {
    // 댓글 수백 개는 그리는 데 수백 ms가 걸려 한 번에 그리면 그동안 스크롤·키 입력이 멈춘다. 뒤로 미뤄 나눠 그린다 (처음엔 빈 목록)
    const comments = useDeferredValue(usePreviewStore((s) => s.comments)!, NO_COMMENTS);
    const collapsed = usePreviewStore((s) => s.collapsed);
    const revealed = useUiStore((s) => s.blockView?.revealed === true);

    // 숨김 차단과 접힌 같은 댓글은 '가린 내용 보기' 동안만 (흐리게) 그린다. 블러 차단은 그려 두고 overlay.scss가 흐린다.
    // 트리 선과 답글 수도 그리는 댓글만 센다.
    const shown = new Set(revealed ? comments : comments.filter((comment) => comment.blocked !== "hide" && comment.duplicates !== 0));
    const parents = threadParents(comments);
    // 답글을 스레드 첫 댓글 번호(c_no)로 한 번에 묶는다. 부모마다 전체를 훑으면 O(n²)이다.
    const repliesOf = Map.groupBy(comments.filter((comment) => comment.depth === 1 && shown.has(comment)), (comment) => comment.c_no);
    // 문서를 querySelector로 훑으므로 댓글마다가 아니라 여기서 한 번 잰다.
    // 모듈 전역에 두면 페이지를 다 읽기 전에 잰 false가 굳는다.
    const isAdmin = isGalleryManager();

    return (
        <Box py="1">
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

                // 펼치기 버튼은 답글이 둘 이상일 때만 있다. 접은 뒤 답글이 하나로 줄면(삭제·차단) 펼칠 수 없게 갇히므로 펼쳐 둔다
                const isCollapsed = replies.length > 1 && collapsed.has(parent.no);

                return (
                    <Fragment key={parent.no}>
                        <Comment comment={parent} depth={0} replyCount={replies.length} threadOpen={!isCollapsed && replies.length > 0} isAdmin={isAdmin}/>
                        {/* 접고 펼 때 높이를 움직인다 (overlay.scss). 처음 그릴 때는 Radix가 애니메이션을 건너뛴다 */}
                        {replies.length > 0 && (
                            <Collapsible.Root open={!isCollapsed}>
                                <Collapsible.Content className="refresher-replies">
                                    {replies.map((child, index) => (
                                        <Comment key={child.no} comment={child} depth={1} replyCount={0} lastReply={index === replies.length - 1} isAdmin={isAdmin}/>
                                    ))}
                                </Collapsible.Content>
                            </Collapsible.Root>
                        )}
                    </Fragment>
                );
            })}
        </Box>
    );
};
