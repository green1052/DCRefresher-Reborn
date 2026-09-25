import {ajax, http} from "@/core/http/client";
import {galleryPath, galleryTypeName, isMiniGallery, urls} from "@/core/http/urls";
import {csrfToken} from "@/utils/cookie";

import {parsePostInfo} from "./parser";
import type {CommentListResponse, DcinsideComment, DcinsideDccon, GalleryPreData, PostInfo} from "./types";

const commonBody = async (link: string): Promise<URLSearchParams> =>
    new URLSearchParams({ci_t: await csrfToken(), _GALLTYPE_: galleryTypeName(link)});

const viewUrl = (link: string, gallery: string, id: string): string => {
    const type = galleryPath(link);

    return `${urls.base}${type}board/view/?id=${gallery}&no=${id}`;
};

/** 게시글 HTML → PostInfo */
export const fetchPost = async (preData: GalleryPreData, signal: AbortSignal): Promise<PostInfo> => {
    const response = await http.get(viewUrl(preData.link, preData.gallery, preData.id), {signal}).text();

    const postInfo = parsePostInfo(response);
    if (!postInfo) throw new Error("404");

    return postInfo;
};

/** 댓글 목록 — 한 쪽에 100개씩이라 쪽을 이어 받는다 */
export const fetchComments = async (preData: GalleryPreData, postInfo: PostInfo, signal: AbortSignal): Promise<CommentListResponse> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("no", preData.id);
    body.set("cmt_id", postInfo.commentId ?? preData.gallery);
    body.set("cmt_no", postInfo.commentNo ?? preData.id);
    body.set("e_s_n_o", postInfo.dom.querySelector<HTMLInputElement>("#e_s_n_o")?.value ?? "");

    const byNo = new Map<string, DcinsideComment>();
    let allowReply = true;

    // ponytail: 10쪽(1000개)까지 — 더 많은 글은 드물고 자동 갱신마다 전부 다시 받는다
    for (let page = 1; page <= 10; page++) {
        body.set("comment_page", String(page));

        const response = await ajax.post(urls.comments, {body, signal}).json<{
            comments: DcinsideComment[] | null;
            total_cnt: number | string;
            pagination: string | null;
            allow_reply?: number | string | null;
        }>();

        // 디시 comment.js처럼 0일 때만 막는다 (멤버만 댓글)
        allowReply = String(response.allow_reply) !== "0";

        const before = byNo.size;
        for (const comment of response.comments ?? []) byNo.set(comment.no, comment);

        // 쪽 나눔이 없거나, 새 댓글이 없거나(빈 쪽·마지막 쪽 반복), 다 받았으면 멈춘다
        if (!response.pagination || byNo.size === before || byNo.size >= Number(response.total_cnt)) break;
    }

    return {list: [...byNo.values()], allowReply};
};

interface VoteResult {
    success: boolean;
    counts?: string;
    fixedCounts?: string;
    /** 실패 이유 (디시가 준 문구) */
    message?: string;
}

/** 추천/비추천 */
export const vote = async (preData: GalleryPreData, postInfo: PostInfo, mode: "U" | "D", code?: string): Promise<VoteResult> => {
    await cookieStore.set({
        name: `${preData.gallery}${preData.id}_Firstcheck${mode === "U" ? "" : "_down"}`,
        value: "Y",
        expires: Date.now() + 3 * 3600_000,
        path: "/",
        domain: "dcinside.com"
    });

    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("no", preData.id);
    body.set("mode", mode);
    body.set("code_recommend", code ?? postInfo.dom.querySelector<HTMLInputElement>("input[name=code_recommend]")?.value ?? "");
    body.set("link_id", preData.gallery);
    if (postInfo.v_cur_t) body.set("v_cur_t", postInfo.v_cur_t);
    if (postInfo.randomParam) body.set(postInfo.randomParam.name, postInfo.randomParam.value);

    const response = await ajax.post(urls.vote, {body}).text();
    const [result, counts, fixedCounts] = response.trim().split("||");

    // 'false||nomember||메시지'면 문구는 세 번째 칸
    return result === "true" ? {success: true, counts, fixedCounts} : {success: false, message: (counts === "nomember" ? fixedCounts : counts) || undefined};
};

const manageUrl = (link: string, base: string, mini: string): string => (isMiniGallery(link) ? mini : base);

/** 관리 요청 결과 — 디시 관리 API는 {"result": "success" | "fail", "msg": "…"}를 돌려준다 */
export interface ManageResult {
    success: boolean;
    /** 디시가 준 안내 문구 (없을 수 있음) */
    message?: string;
}

// 성공이라고 밝힌 응답만 성공 — 세션이 끊겨 온 HTML이나 "정상적인 접근이 아닙니다." 같은 모르는 응답에 '삭제했습니다'를 띄우지 않게
const isSuccess = (result: unknown): boolean => result === "success" || result === "true" || result === true;

export const postManage = async (url: string, body: URLSearchParams): Promise<ManageResult> => {
    const text = (await ajax.post(url, {body}).text()).trim();

    try {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
            const {result, msg} = parsed as { result?: unknown; msg?: unknown };
            return {success: isSuccess(result), message: typeof msg === "string" && msg ? msg : undefined};
        }
    } catch {
        // 아래 텍스트 분기로
    }

    // JSON 객체가 아니면 "false||메시지" 같은 텍스트 — 맨 'true'·'false'는 JSON 원시값으로 읽히므로 여기서 본다
    const [result, message] = text.split("||");
    return {success: isSuccess(result), message: message || undefined};
};

/** 글 하나를 대상으로 하는 관리 요청 — 끌올·삭제는 본문이 같고 주소만 다르다 */
const managePost = async (preData: GalleryPreData, base: string, mini: string): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("nos[]", preData.id);

    return postManage(manageUrl(preData.link, base, mini), body);
};

/** 끌올 */
export const bump = (preData: GalleryPreData): Promise<ManageResult> => managePost(preData, urls.manage.bump, urls.manage.bumpMini);

/** 삭제 */
export const deletePost = (preData: GalleryPreData): Promise<ManageResult> => managePost(preData, urls.manage.delete, urls.manage.deleteMini);

interface BlockOptions {
    avoidHour: string;
    avoidReason: string;
    avoidReasonTxt: string;
    delChk: "0" | "1";
    userTypeChk: "0" | "1";
}

/** 유저 차단 (관리 팝업/프리셋) */
export const blockUser = async (preData: GalleryPreData, options: BlockOptions): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("nos[]", preData.id);
    body.set("parent", "");
    body.set("avoid_hour", options.avoidHour);
    body.set("avoid_reason", options.avoidReason);
    body.set("avoid_reason_txt", options.avoidReasonTxt);
    body.set("del_chk", options.delChk);
    body.set("avoid_type_chk", options.userTypeChk);

    return postManage(manageUrl(preData.link, urls.manage.block, urls.manage.blockMini), body);
};

/** 공지 등록/해제 */
export const setNotice = async (preData: GalleryPreData, notice: boolean): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("mode", notice ? "SET" : "REL");
    body.set("id", preData.gallery);
    body.set("no", preData.id);

    return postManage(manageUrl(preData.link, urls.manage.setNotice, urls.manage.setNoticeMini), body);
};

/** 개념글 등록/해제 */
export const setRecommend = async (preData: GalleryPreData, recommend: boolean): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("mode", recommend ? "SET" : "REL");
    body.set("id", preData.gallery);
    body.set("nos[]", preData.id);

    return postManage(manageUrl(preData.link, urls.manage.setRecommend, urls.manage.setRecommendMini), body);
};

/** 이미지 캡챠 URL */
export const captchaImage = (preData: GalleryPreData, type: "comment" | "recommend"): string =>
    `${urls.base}kcaptcha/image_v3/?gall_id=${preData.gallery}&kcaptcha_type=${type}&time=${Date.now()}&_GALLTYPE_=${galleryTypeName(preData.link)}`;

/** 관리자 댓글 삭제 */
export const adminDeleteComment = async (preData: GalleryPreData, commentId: string): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("pno", preData.id);
    body.set("cmt_nos[]", commentId);

    return postManage(manageUrl(preData.link, urls.manage.deleteComment, urls.manage.deleteCommentMini), body);
};

/** 유저 댓글 삭제 */
export const userDeleteComment = async (preData: GalleryPreData, commentId: string, password: string): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("no", preData.id);
    body.set("re_no", commentId);
    body.set("mode", "del");
    if (password) body.set("re_password", password);
    body.set("g-recaptcha-response", "");

    // 'true'만 성공 (v5와 같음) — 관리 요청과 달리 JSON이 아니다
    const {result, message} = submitResult(await ajax.post(urls.comment_remove, {body}).text());
    return {success: result === "true", message};
};

export interface SubmitResult {
    result: string;
    message?: string;
    /** 'false||captcha||v3'의 v3, 'false||nomember||메시지'의 메시지 */
    detail?: string;
}

const submitResult = (response: string): SubmitResult => {
    const [result, message, detail] = response.trim().split("||");

    return {result: result ?? "", message, detail};
};

/** 댓글/디시콘 작성. 첫 전송은 grecaptchaToken 없이 (디시 f_submit(null)) */
export const submitComment = async (
    preData: GalleryPreData,
    postInfo: PostInfo,
    user: { name: string; pw?: string },
    memo: string | DcinsideDccon[],
    commentNo: string | null,
    replyNo: string | null,
    bigDccon: boolean,
    captcha?: string,
    grecaptchaToken?: string
): Promise<SubmitResult> => {
    const {dom} = postInfo;

    const code = (() => {
        try {
            // 디시 _d(): 알파벳을 섞은 base64 — 표준 알파벳으로 바꿔 푼다 (65번째 '='는 채움, 모르는 글자는 버린다)
            const rKey = "yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBs1Ct2D3uE4Fv5G6wHl78xJ9K";
            const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

            const script = dom.querySelector<HTMLElement>("#reply-setting-tmpl + script");
            const dValue = script?.textContent?.match(/_d\('(.*)'\)/)?.[1];
            if (!dValue) return null;

            let decoded = atob(dValue.replace(/./g, (c) => b64[rKey.indexOf(c)] ?? ""));
            if (!decoded) return null;

            let fi = parseInt(decoded.slice(0, 1));
            fi = fi > 5 ? fi - 5 : fi + 4;
            decoded = decoded.replace(/^./, fi.toString());

            const serviceInput = dom.querySelector<HTMLInputElement>("input[name=service_code]");
            const service = serviceInput?.value ?? "";

            const rs = decoded.split(",");
            let computed = "";

            for (let index = 0; index < rs.length; index++) {
                computed += String.fromCharCode((2 * (Number(rs[index]) - index - 1)) / (13 - index - 1));
            }

            return service.replace(/(.{10})$/, computed);
        } catch {
            return null;
        }
    })();
    // 토큰 없이 보내면 서버는 모호한 오류만 준다 — 보내지 않고 알린다
    if (!code) return {result: "false", message: "댓글 폼을 읽지 못했습니다. 원문에서 작성해 주세요."};

    const params = new URLSearchParams();
    params.set("t_vch2", "");
    params.set("t_vch2_chk", "");

    for (const element of dom.querySelectorAll<HTMLInputElement>("#focus_cmt > input")) {
        const name = element.name || element.id || "";
        if (!["service_code", "gallery_no", "clickbutton"].includes(name)) params.set(name, element.value);
    }

    params.set("service_code", code);
    params.set("c_gall_id", preData.gallery);
    params.set("c_gall_no", preData.id);
    params.set("id", preData.gallery);
    params.set("no", preData.id);

    if (commentNo) params.set("c_no", commentNo);
    if (replyNo) params.set("reply_no", replyNo);

    params.set("name", user.name);
    if (user.pw) params.set("password", user.pw);
    params.set("use_gall_nick", "N");
    if (captcha) params.set("code", captcha);
    params.set("g-recaptcha-response", "");
    if (grecaptchaToken) params.set("g-recaptcha-token", grecaptchaToken);

    if (bigDccon) params.set("bigdccon", "1");

    if (typeof memo === "string") {
        params.set("memo", memo);
    } else {
        params.set("input_type", "comment");
        if (memo.length > 1) params.set("double_con_chk", "1");
        params.set("package_idx", memo.map((dccon) => dccon.package_idx).join(","));
        params.set("detail_idx", memo.map((dccon) => dccon.detail_idx).join(","));
    }

    const response = await ajax.post(typeof memo === "string" ? urls.comments_submit : urls.dccon_comments_submit, {
        body: params
    }).text();

    return submitResult(response);
};

/* ===== 글자콘 — 디시 txtcon.js의 입력 규칙 (서버 txtcon_conf와 같다) ===== */

export const TXTCON_BACKGROUNDS = ["3b4890", "b4b4e1", "f5e1f0", "d2f0e6", "ffffff", "333333"];
export const TXTCON_COLORS = ["ffffff", "333333"];

const TXTCON_MAX_LEN = 20;
const TXTCON_MAX_LINES = 4;
/** 한 줄 최대 글자 수 */
const TXTCON_MAX_LINE_LEN = 5;

// 컬러 이모지로 그려지는 BMP 문자 — 글자 수에 1을 더 센다
const TXTCON_BMP_EMOJI = /[\p{Emoji_Presentation}--[\u{10000}-\u{10FFFF}]]/gv;

/** 글자 수: UTF-16 코드 유닛 + BMP 컬러 이모지 가산 (줄바꿈 제외) */
const txtconLength = (text: string): number => {
    const plain = text.replaceAll("\n", "");

    return plain.length + (plain.match(TXTCON_BMP_EMOJI)?.length ?? 0);
};

// ponytail: 디시 txtcon_clusters 대신 브라우저 grapheme 분할 — 흔한 글자(국기·스킨톤·ZWJ 포함)에선 같다 (분해형 한글 자모 등만 다름)
const segmenter = new Intl.Segmenter();
/** 글자콘의 '한 글자' 단위로 나눈다 */
export const graphemes = (text: string): string[] => Array.from(segmenter.segment(text), ({segment}) => segment);

/** 직접 줄바꿈은 두고 각 줄을 5글자씩 나눈다 — 입력 제한과 보여 줄 때(Comment.tsx)가 같이 쓴다 */
export const wrapTxtcon = (text: string): string =>
    text
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => graphemes(line).map((char, i) => (i && i % TXTCON_MAX_LINE_LEN === 0 ? "\n" : "") + char).join(""))
        .join("\n");

/** 글자콘 입력값 정리 (txtcon.js 'wide' 문자 필터 + 20자·4줄·줄당 5자 제한) */
export const normalizeTxtcon = (value: string): string => {
    let text = value
        .replace(/\r\n?/g, "\n")
        // 이모지 구간 밖 4바이트·아랍 표현형은 '+'
        .replace(/[[\u{10000}-\u{10FFFF}]--[\u{1F000}-\u{1FAFF}]]/gv, "+")
        .replace(/[\uFB50-\uFDFF\uFE70-\uFEFE]/g, "+")
        // 공백류는 일반 공백, 안 보이는 채움 문자는 제거
        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
        .replace(/[\u2800\u115F\u1160\u3164\uFFA0\u034F\u17B4\u17B5]/g, "")
        .replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Zs}\p{M}\u{1F000}-\u{1FAFF}\u200D\uFE00-\uFE0F\n]/gu, "")
        .replace(/[{}]/g, "")
        // 결합 기호 연속은 2개까지
        .replace(/\p{M}{3,}/gu, (marks) => Array.from(marks).slice(0, 2).join(""))
        .replace(/\.{4,}/g, "...")
        .split("\n")
        .slice(0, TXTCON_MAX_LINES)
        .join("\n");

    // 4줄(줄바꿈 3개)×5글자면 23 grapheme을 넘을 수 없다 — 미리 줄여 두어야 한 글자씩 빼며 전체를 다시 나누는 아래 루프가 긴 붙여넣기에서 O(n²)가 되지 않는다
    text = graphemes(text).slice(0, (TXTCON_MAX_LINE_LEN + 1) * TXTCON_MAX_LINES).join("");

    // 5글자씩 나눈 줄 수가 넘치면 뒤에서부터 제거
    while (wrapTxtcon(text).split("\n").length > TXTCON_MAX_LINES) text = Array.from(text).slice(0, -1).join("");

    // 글자 수 제한 (코드포인트 단위로 앞에서 자른다 — 넘치는 글자만 건너뛰면 가운데가 빠지고 뒤의 ZWJ·결합 문자가 엉뚱한 글자에 붙는다)
    let count = 0;
    let output = "";
    for (const char of text) {
        const width = txtconLength(char);
        if (count + width > TXTCON_MAX_LEN) break;

        output += char;
        count += width;
    }

    return output;
};

/** 글자콘 작성 (txtcon.js txtcon_submit). 첫 전송은 grecaptchaToken 없이 */
export const submitTxtcon = async (
    preData: GalleryPreData,
    postInfo: PostInfo,
    user: { name: string; pw?: string },
    text: string,
    colors: { bg: string; txt: string },
    commentNo: string | null,
    replyNo: string | null,
    captcha?: string,
    grecaptchaToken?: string
): Promise<SubmitResult> => {
    const {dom} = postInfo;

    const body = await commonBody(preData.link);
    body.set("id", postInfo.commentId ?? preData.gallery);
    body.set("no", postInfo.commentNo ?? preData.id);
    body.set("txtcon_text", text);
    body.set("txtcon_bg", colors.bg);
    body.set("txtcon_color", colors.txt);

    if (commentNo) body.set("c_no", commentNo);
    if (replyNo) body.set("reply_no", replyNo);

    if (user.name) body.set("name", user.name);
    if (user.pw) body.set("password", user.pw);
    if (captcha) body.set("code", captcha);

    for (const name of ["check_6", "check_7", "check_8"]) {
        body.set(name, dom.querySelector<HTMLInputElement>(`#${name}`)?.value ?? "");
    }

    // 갤닉은 댓글(submitComment)처럼 쓰지 않는다
    if (dom.querySelector("#use_gall_nick")) {
        body.set("gall_nick_name", dom.querySelector<HTMLInputElement>("#gall_nick_name")?.value ?? "");
        body.set("use_gall_nick", "N");
    }

    body.set("g-recaptcha-response", "");
    if (grecaptchaToken) body.set("g-recaptcha-token", grecaptchaToken);

    const response = await ajax.post(urls.txtcon_submit, {body}).text();

    return submitResult(response);
};
