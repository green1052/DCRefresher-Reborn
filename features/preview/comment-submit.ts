import {type CommentRcKey, type GrecaptchaRequest, sendMessage, type TurnstileResult} from "@/core/messaging/protocol";
import {type ManageResult, resultMessage, submitComment, type SubmitResult, submitTxtcon, userDeleteComment} from "@/core/preview/request";
import type {DcinsideDccon, GalleryPreData, PostInfo, TurnstileConfig} from "@/core/preview/types";

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

/** 글 댓글의 reCAPTCHA 키 쌍. 디시는 페이지마다 반반으로 고른다. 재전송 토큰도 같은 쌍으로 받아야 서버가 확인한다. */
const pickRcKey = (): CommentRcKey => (Math.random() < 0.5 ? "new" : "new3");

/** 토큰 없이 보내고, 'false||captcha||v3'가 오면 reCAPTCHA v3 토큰을 붙여 한 번 더 보낸다. 토큰을 받지 못하면 첫 응답을 돌려준다. */
const sendWithV3 = async (send: (token?: string) => Promise<SubmitResult>, request: GrecaptchaRequest): Promise<SubmitResult> => {
    const response = await send();
    if (response.message !== "captcha" || response.detail !== "v3") return response;
    const token = await sendMessage("refresher:grecaptchaToken", request).catch(() => undefined);
    return token ? send(token) : response;
};

/** 토큰은 받은 뒤 300초 동안 쓸 수 있다. 미리 받아 둔 것은 그보다 일찍 버린다. */
const PREFETCH_TTL = 240_000;

/** 폼에 들어올 때 미리 받기 시작한 토큰 (prefetchTurnstile). 한 번 쓰면 비운다. */
let prefetched: { sitekey: string; at: number; result: Promise<TurnstileResult | undefined> } | undefined;

/** 보이지 않게 그려 받는다. 처음 그릴 때는 api.js를 받고 판정하느라 10초 넘게 걸리기도 한다. */
const hiddenToken = (config: TurnstileConfig): Promise<TurnstileResult | undefined> =>
    sendMessage("refresher:turnstileToken", {config, visible: false}).catch(() => undefined);

const freshPrefetch = (config: TurnstileConfig) =>
    prefetched?.sitekey === config.sitekey && Date.now() - prefetched.at < PREFETCH_TTL ? prefetched : undefined;

/** 디시 ts_cmt_touch처럼 댓글 폼에 들어오면 토큰을 미리 받기 시작해, 보낼 때 기다리지 않게 한다. */
export const prefetchTurnstile = (config: TurnstileConfig): void => {
    if (!freshPrefetch(config)) prefetched = {sitekey: config.sitekey, at: Date.now(), result: hiddenToken(config)};
};

/**
 * 디시 ts_cmt_fields가 보내는 Turnstile 칸. 먼저 보이지 않게 토큰을 받고, 확인을 눌러야 하면(interactive) ask(확인 창)로 받는다.
 * 창을 닫으면 undefined다 (보내지 않는다). 토큰을 받지 못해도 디시처럼 상태를 담아 보낸다 (서버가 거절하면 그 메시지를 보인다).
 * focusMs는 폼에 처음 들어온 뒤 지난 시간이다 (디시 ts_focus_ms, 들어온 적 없으면 0).
 */
export const turnstileFields = async (
    config: TurnstileConfig,
    focusMs: number,
    ask: (config: TurnstileConfig) => Promise<TurnstileResult | undefined>
): Promise<Record<string, string> | undefined> => {
    const reuse = freshPrefetch(config);
    prefetched = undefined;
    let result = await (reuse?.result ?? hiddenToken(config));
    if (result && !result.token && result.state === "interactive") {
        result = await ask(config);
        if (!result) return undefined;
    }
    return {
        "cf-turnstile-response": result?.token ?? "",
        ts_state: result?.token ? "ok" : (result?.state ?? "error"),
        ts_focus_ms: String(focusMs),
        ts_token_ms: String(result?.tokenMs ?? 0),
        ...(config.test && {ts_test: "1"})
    };
};

/** captcha: 원문 페이지에서만 풀 수 있는 자동입력 방지 확인을 요구받았다. */
type CommentOutcome = { ok: true } | { ok: false; captcha: true } | { ok: false; captcha: false; message: string };

/**
 * 댓글·디시콘·글자콘을 보낸다. 처음엔 토큰 없이 보내고, 'false||captcha||v3'가 오면 reCAPTCHA v3 토큰을 붙여 한 번 더 보낸다
 * (디시 comment.js·dccon.js·txtcon.js와 같음). turnstile(turnstileFields)은 두 전송에 같이 붙인다 (디시도 formData에 한 번 붙인다).
 * 요청이 끊기면 던진다 (서버는 댓글을 올렸을 수 있다).
 */
export const postComment = async (
    preData: GalleryPreData,
    post: PostInfo,
    user: { name: string; pw?: string },
    content: CommentContent,
    reply: { commentNo: string | null; replyNo: string | null },
    code?: string,
    turnstile?: Record<string, string>
): Promise<CommentOutcome> => {
    const useDccon = content.dccons.length > 0;
    const rcKey = pickRcKey();
    const send = (grecaptchaToken?: string): Promise<SubmitResult> => {
        const fields = {user, ...reply, captcha: code, grecaptchaToken, turnstile};
        return content.txtcon
            ? submitTxtcon(preData, post, {...fields, text: content.text, colors: content.txtcon})
            : submitComment(preData, post, {...fields, memo: useDccon ? content.dccons : content.text, bigDccon: useDccon && content.bigDccon, rcKey});
    };

    const response = await sendWithV3(send, content.txtcon || useDccon ? {action: "insert_icon"} : {action: "comment_submit", rcKey});

    // 성공 응답: 댓글은 새 댓글 번호, 디시콘·글자콘은 'ok'.
    if (content.txtcon || useDccon ? response.result === "ok" : isCommentPosted(response)) return {ok: true};
    // v2 체크박스를 요구하거나 v3 재전송도 막히면 원문 페이지에서만 풀 수 있다.
    if (response.message === "captcha") return {ok: false, captcha: true};
    const failMessage = Object.hasOwn(FAIL_MESSAGES, response.result) ? FAIL_MESSAGES[response.result]
        : useDccon && Object.hasOwn(DCCON_FAIL_MESSAGES, response.result) ? DCCON_FAIL_MESSAGES[response.result] : undefined;
    return {ok: false, captcha: false, message: (response.result === "false" ? resultMessage(response) : failMessage) || "댓글을 작성하지 못했습니다."};
};

/**
 * 본인 댓글 삭제 (비밀번호·회원). 'false||captcha||v3'가 오면 작성처럼 v3 토큰을 붙여 한 번 더 보낸다 (디시 comment.js의 비밀번호 삭제).
 */
export const deleteOwnComment = async (preData: GalleryPreData, post: PostInfo, commentNo: string, password: string): Promise<ManageResult> => {
    const rcKey = pickRcKey();
    const response = await sendWithV3((token) => userDeleteComment(preData, post, commentNo, password, rcKey, token), {action: "comment_delete_submit", rcKey});

    // 'true'만 성공으로 본다. 비밀번호가 틀려도 HTTP 200('false||메시지')이 온다.
    if (response.result === "true") return {success: true};
    return {success: false, message: response.message === "captcha" ? "자동입력 방지 확인이 필요합니다. 원문에서 삭제해 주세요." : resultMessage(response)};
};
