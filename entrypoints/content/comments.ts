import {isViewPage} from "@/core/http/urls";
import {sendMessage} from "@/core/messaging/protocol";

/**
 * 디시가 처음 그리다 실패한 댓글 목록인지 (#269).
 * 디시는 댓글을 받으면 댓글 수부터 적고 목록을 그린다. 다 읽은 페이지에 댓글 수는 있는데 목록이 없으면 그리다 실패한 것이다.
 * 본문 이미지마다 붙는 이미지 댓글(.view_comment.image_comment)도 .comment_wrap이고 본문 안이라 먼저 나온다. id가 있는 글 댓글 칸만 본다.
 */
export const commentsFailedToRender = (root: ParentNode = document): boolean => {
    const wrap = root.querySelector(".view_comment:not(.image_comment) .comment_wrap[id^=comment_wrap_]");
    const total = Number(wrap?.querySelector("[id^=comment_total_]")?.textContent?.replaceAll(",", ""));
    return Boolean(wrap) && total > 0 && !wrap!.querySelector(":scope > .comment_box");
};

/**
 * 글 보기에서 디시가 첫 댓글 목록을 그리지 못했으면 페이지를 다 읽은 뒤 한 번 다시 그리게 한다.
 * 디시 comment.js는 디시콘 영상 댓글을 그릴 때 선언하지 않은 전역 index를 읽는다. 그 전역은 나중에 읽히는 다른 디시 스크립트가 만든다.
 * 댓글 응답이 그보다 먼저 오면 ReferenceError가 나고 comment.js의 catch(e) {}가 삼켜 댓글이 하나도 안 보인다.
 * 댓글을 쓰는 등으로 다시 그리면 보이므로, load 뒤(전역이 생긴 뒤) 디시의 viewComments를 다시 부른다.
 */
export const redrawFailedComments = (signal: AbortSignal): void => {
    if (!isViewPage) return;

    const check = (): void => {
        if (commentsFailedToRender()) void sendMessage("refresher:redrawComments").catch(console.error);
    };
    if (document.readyState === "complete") check();
    else window.addEventListener("load", check, {once: true, signal});
};
