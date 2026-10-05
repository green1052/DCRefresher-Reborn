import {sendMessage} from "@/core/messaging/protocol";
import {resultMessage, submitComment, type SubmitResult, submitTxtcon} from "@/core/preview/request";
import type {DcinsideDccon, GalleryPreData, PostInfo} from "@/core/preview/types";

// 'false||메시지' 형식이 아닌 실패 응답 코드 (디시 dccon.js·txtcon.js에서 옮김).
const FAIL_MESSAGES: Record<string, string> = {
    code_fail: "자동입력 방지 코드가 일치하지 않습니다.",
    fail1: "닉네임과 비밀번호를 정확하게 입력해 주세요.",
    form_error: "닉네임과 비밀번호를 정확하게 입력해 주세요."
};

// 디시콘 댓글만의 실패 응답 코드 (디시 dccon.js와 같은 문구). 글·글자콘 댓글이 fail을 받아도 디시콘 문구를 보이지 않게 나눈다.
const DCCON_FAIL_MESSAGES: Record<string, string> = {
    not_buy: "구매내역이 존재하지 않는 디시콘입니다.",
    expired: "사용기간이 만료된 디시콘입니다.",
    unuseable: "해당 디시콘은 현재 사용 불가능합니다.",
    not_exists: "잘못된 파일 경로 입니다.",
    fail: "디시콘 입력에 실패하였습니다."
};

/**
 * 댓글이 올라갔는지. 디시 comment.js처럼 'false'가 아니면 성공(새 댓글 번호)으로 보되, 확실한 실패는 거른다:
 * 실패 코드, 빈 응답, HTML 페이지(로그인이 풀렸거나 오류 페이지). 성공으로 잘못 보면 입력한 글을 지워 버린다.
 */
export const isCommentPosted = ({result}: SubmitResult): boolean =>
    result !== "false" && result !== "" && !result.trimStart().startsWith("<") && !Object.hasOwn(FAIL_MESSAGES, result) && !Object.hasOwn(DCCON_FAIL_MESSAGES, result);

/** 보낼 댓글. 디시콘이 있으면 디시콘을, txtcon(색)이 있으면 글자콘을, 아니면 글을 보낸다. */
interface CommentContent {
    text: string;
    dccons: DcinsideDccon[];
    bigDccon: boolean;
    txtcon?: { bg: string; txt: string };
}

/** captcha: 원문 페이지에서만 풀 수 있는 자동입력 방지 확인을 요구받았다. */
type CommentOutcome = { ok: true } | { ok: false; captcha: true } | { ok: false; captcha: false; message: string };

/**
 * 댓글·디시콘·글자콘을 보낸다. 처음엔 토큰 없이 보내고, 'false||captcha||v3'가 오면 reCAPTCHA v3 토큰을 붙여 한 번 더 보낸다
 * (디시 comment.js·dccon.js·txtcon.js와 같음). 요청이 끊기면 던진다 (서버는 댓글을 올렸을 수 있다).
 */
export const postComment = async (
    preData: GalleryPreData,
    post: PostInfo,
    user: { name: string; pw?: string },
    content: CommentContent,
    reply: { commentNo: string | null; replyNo: string | null },
    code?: string
): Promise<CommentOutcome> => {
    const useDccon = content.dccons.length > 0;
    const send = (token?: string): Promise<SubmitResult> =>
        content.txtcon
            ? submitTxtcon(preData, post, user, content.text, content.txtcon, reply.commentNo, reply.replyNo, code, token)
            : submitComment(preData, post, user, useDccon ? content.dccons : content.text, reply.commentNo, reply.replyNo, useDccon && content.bigDccon, code, token);

    let response = await send();
    if (response.message === "captcha" && response.detail === "v3") {
        const token = await sendMessage("refresher:grecaptchaToken", content.txtcon || useDccon ? "insert_icon" : "comment_submit").catch(() => undefined);
        if (token) response = await send(token);
    }

    // 성공 응답: 댓글은 새 댓글 번호, 디시콘·글자콘은 'ok'.
    if (content.txtcon || useDccon ? response.result === "ok" : isCommentPosted(response)) return {ok: true};
    // v2 체크박스를 요구하거나 v3 재전송도 막히면 원문 페이지에서만 풀 수 있다.
    if (response.message === "captcha") return {ok: false, captcha: true};
    const failMessage = Object.hasOwn(FAIL_MESSAGES, response.result) ? FAIL_MESSAGES[response.result]
        : useDccon && Object.hasOwn(DCCON_FAIL_MESSAGES, response.result) ? DCCON_FAIL_MESSAGES[response.result] : undefined;
    return {ok: false, captcha: false, message: (response.result === "false" ? resultMessage(response) : failMessage) || "댓글을 작성하지 못했습니다."};
};
