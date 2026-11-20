import {ajax, formBody} from "@/core/http/client";
import {csrfBody} from "@/core/http/cookie";
import {urls} from "@/core/http/urls";
import type {CommentRcKey} from "@/core/messaging/protocol";

import {decodeD} from "./dcinside-js";
import {fcmToken} from "./fcm";
import {type SubmitResult, submitResult} from "./response";
import type {DcinsideDccon, GalleryPreData, PostInfo} from "./types";

/** 댓글/디시콘 작성. 첫 전송은 디시처럼 grecaptchaToken 없이 보낸다. */
export const submitComment = async (
    preData: GalleryPreData,
    postInfo: PostInfo,
    {user, memo, commentNo, replyNo, bigDccon, captcha, rcKey, grecaptchaToken, turnstile}: {
        user: { name: string; pw?: string };
        memo: string | DcinsideDccon[];
        commentNo: string | null;
        replyNo: string | null;
        bigDccon: boolean;
        captcha?: string;
        rcKey?: CommentRcKey;
        grecaptchaToken?: string;
        /** 디시 ts_cmt_fields처럼 끝에 붙이는 Turnstile 칸. */
        turnstile?: Record<string, string>;
    }
): Promise<SubmitResult> => {
    const form = postInfo.commentForm;

    const code = (() => {
        try {
            if (!form.dValue) return null;

            const decoded = decodeD(form.dValue);
            if (!decoded) return null;

            // dValue로 계산한 값으로 service_code 끝 10자리를 갈아 끼운다.
            const fi = parseInt(decoded.slice(0, 1));
            const values = decoded.replace(/^./, String(fi > 5 ? fi - 5 : fi + 4)).split(",").map(Number);
            // 디시가 형식을 바꿔 숫자가 아니면 NaN이 "NaN", "\0"으로 섞여 들어가 던지지 않고 틀린 코드가 된다.
            if (Number.isNaN(fi) || values.some(Number.isNaN)) return null;
            const computed = values.map((value, index) => String.fromCharCode((2 * (value - index - 1)) / (13 - index - 1))).join("");

            // computed에 $ 문자가 섞이면 교체 문자열 문법으로 읽히므로 함수로 넘긴다.
            return form.serviceCode.replace(/(.{10})$/, () => computed);
        } catch {
            return null;
        }
    })();
    // service_code를 못 만든 채 보내면 서버가 모호한 오류만 주므로 보내지 않고 알린다.
    if (!code) return {result: "false", message: "댓글 폼을 읽지 못했습니다. 원문에서 작성해 주세요."};

    // 글이 정한 comment_id/no를 쓴다. 없으면 이 글이다.
    const gallery = postInfo.commentId ?? preData.gallery;
    const no = postInfo.commentNo ?? preData.id;
    // 같은 이름 폼 필드는 아래 값으로 바뀐다. 디시콘 댓글만 CSRF 토큰도 보낸다.
    const params = await (typeof memo === "string" ? formBody : csrfBody)({
        t_vch2: "",
        t_vch2_chk: "",
        ...Object.fromEntries(form.fields.filter(([name]) => !["service_code", "gallery_no", "clickbutton"].includes(name))),
        service_code: code,
        c_gall_id: gallery,
        c_gall_no: no,
        id: gallery,
        no,
        c_no: commentNo || undefined,
        reply_no: replyNo || undefined,
        name: user.name,
        password: user.pw || undefined,
        use_gall_nick: "N",
        code: captcha || undefined,
        "g-recaptcha-response": "",
        "g-recaptcha-token": grecaptchaToken || undefined,
        bigdccon: bigDccon && "1",
        ...(typeof memo === "string"
            ? {memo, rc_key: rcKey}
            : {
                input_type: "comment",
                double_con_chk: memo.length > 1 && "1",
                package_idx: memo.map((dccon) => dccon.package_idx).join(","),
                detail_idx: memo.map((dccon) => dccon.detail_idx).join(",")
            }),
        ...turnstile
    });

    return submitResult(await ajax.post(typeof memo === "string" ? urls.comments_submit : urls.dccon_comments_submit, {body: params, headers: {fcmToken: await fcmToken()}}).text());
};
