import {Box} from "@radix-ui/themes";
import {Collapsible} from "radix-ui";
import {Fragment} from "react";

import {useUiStore} from "@/stores/ui";
import {isGalleryManager} from "@/utils/user";

import {Comment} from "./Comment";
import {usePreviewStore} from "./previewStore";

/** 쓰레드별 댓글과 접을 수 있는 답글 */
export const CommentList = () => {
    const comments = usePreviewStore((s) => s.comments)!;
    const collapsed = usePreviewStore((s) => s.collapsed);
    const revealed = useUiStore((s) => s.blockView?.revealed === true);

    // 숨김 차단과 접힌 같은 댓글은 '가린 내용 보기' 동안만 (흐리게) 그린다. 블러 차단은 그려 두고 overlay.scss가 흐린다.
    // 트리 선과 답글 수도 그리는 댓글만 센다.
    const shown = new Set(revealed ? comments : comments.filter((comment) => comment.blocked !== "hide" && comment.duplicates !== 0));
    const parents = comments.filter((comment) => comment.depth === 0);
    // 답글을 쓰레드 첫 댓글 번호(c_no)로 한 번에 묶는다. 부모마다 전체를 훑으면 O(n²)이다.
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

                const isCollapsed = collapsed.has(parent.no);

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
