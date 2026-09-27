import {ajax, http} from "@/core/http/client";
import {galleryPath, galleryTypeName, isMiniGallery, urls} from "@/core/http/urls";
import {csrfToken} from "@/utils/cookie";

import {parsePostInfo} from "./parser";
import type {CommentListResponse, DcinsideComment, DcinsideDccon, GalleryPreData, PostInfo} from "./types";

const commonBody = async (link: string): Promise<URLSearchParams> =>
    new URLSearchParams({ci_t: await csrfToken(), _GALLTYPE_: galleryTypeName(link)});

export const viewUrl = (link: string, gallery: string, id: string): string => {
    const type = galleryPath(link);

    return `${urls.base}${type}board/view/?id=${gallery}&no=${id}`;
};

/** 게시글을 받아 PostInfo로 푼다. 글이 없으면 Error("404") */
export const fetchPost = async (preData: GalleryPreData, signal: AbortSignal): Promise<PostInfo> => {
    const response = await http.get(viewUrl(preData.link, preData.gallery, preData.id), {signal}).text();

    const postInfo = parsePostInfo(response);
    if (!postInfo) throw new Error("404");

    return postInfo;
};

/** 댓글 목록. 한 쪽에 100개씩이라 여러 쪽을 받아 합친다 */
export const fetchComments = async (preData: GalleryPreData, postInfo: PostInfo, signal: AbortSignal): Promise<CommentListResponse> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("no", preData.id);
    body.set("cmt_id", postInfo.commentId ?? preData.gallery);
    body.set("cmt_no", postInfo.commentNo ?? preData.id);
    body.set("e_s_n_o", postInfo.esno ?? "");

    const fetchPage = (page: number) => {
        const pageBody = new URLSearchParams(body);
        pageBody.set("comment_page", String(page));
        return ajax.post(urls.comments, {body: pageBody, signal}).json<{
            comments: DcinsideComment[] | null;
            total_cnt: number | string;
            pagination: string | null;
            allow_reply?: number | string | null;
        }>();
    };

    // 1쪽의 쪽 나눔(viewComments(n, …))에서 마지막 쪽 번호를 읽고 나머지 쪽은 한꺼번에 받는다. 동시 요청 수는 요청 제한 모듈이 조절한다.
    // ponytail: 10쪽(1000개)까지만 받는다. 더 많은 글은 드물고, 자동 갱신 때마다 전부 다시 받기 때문이다.
    const first = await fetchPage(1);
    const lastPage = Math.min(10, Math.max(1, ...Array.from(first.pagination?.matchAll(/viewComments\((\d+)/g) ?? [], (match) => Number(match[1]))));
    const rest = await Promise.all(Array.from({length: lastPage - 1}, (_, index) => fetchPage(index + 2)));

    // 쪽 순서대로 합친다. 쪽 사이에 같은 댓글이 겹쳐 올 수 있어 번호로 하나만 남긴다
    const byNo = new Map<string, DcinsideComment>();
    for (const response of [first, ...rest]) {
        for (const comment of response.comments ?? []) byNo.set(comment.no, comment);
    }

    // 디시 comment.js처럼 0일 때만 막는다 (멤버만 댓글)
    return {list: [...byNo.values()], allowReply: String(first.allow_reply) !== "0"};
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
    body.set("code_recommend", code ?? postInfo.recommendCode ?? "");
    body.set("link_id", preData.gallery);
    if (postInfo.v_cur_t) body.set("v_cur_t", postInfo.v_cur_t);
    if (postInfo.randomParam) body.set(postInfo.randomParam.name, postInfo.randomParam.value);

    const response = await ajax.post(urls.vote, {body}).text();
    const [result, counts, fixedCounts] = response.trim().split("||");

    // 'false||nomember||메시지'면 문구는 세 번째 칸
    return result === "true" ? {success: true, counts, fixedCounts} : {success: false, message: (counts === "nomember" ? fixedCounts : counts) || undefined};
};

/** 관리 요청 결과. 디시 관리 API는 {"result": "success" | "fail", "msg": "…"}를 돌려준다 */
export interface ManageResult {
    success: boolean;
    /** 디시가 준 안내 문구 (없을 수 있음) */
    message?: string;
}

// 성공이라고 밝힌 응답만 성공으로 본다. 세션이 끊겨 온 HTML이나 "정상적인 접근이 아닙니다." 같은 응답에 성공 알림을 띄우지 않게
const isSuccess = (result: unknown): boolean => result === "success" || result === "true" || result === true;

/**
 * 관리 요청. 미니 갤러리는 mini_, 나머지(일반·마이너·인물)는 minor_ 관리 API를 쓴다.
 * 필드는 공통 필드(ci_t, _GALLTYPE_) 뒤에 준 순서대로 붙는다.
 */
const manage = async (target: Pick<GalleryPreData, "link">, action: string, fields: Record<string, string>): Promise<ManageResult> => {
    const body = await commonBody(target.link);
    for (const [key, value] of Object.entries(fields)) body.set(key, value);

    const url = `${urls.base}ajax/${isMiniGallery(target.link) ? "mini" : "minor"}_manager_board_ajax/${action}`;
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

    // JSON 객체가 아니면 "false||메시지" 같은 텍스트다. 맨 'true'·'false'도 JSON.parse가 원시값으로 읽어 여기로 온다
    const [result, message] = text.split("||");
    return {success: isSuccess(result), message: message || undefined};
};

/** 끌올 */
export const bump = (preData: GalleryPreData): Promise<ManageResult> => manage(preData, "update_bump", {id: preData.gallery, "nos[]": preData.id});

/** 게시글 삭제. manage 모듈의 Ctrl+클릭은 목록 행에서 얻은 갤러리·글 번호·주소만 있어 GalleryPreData 전체를 받지 않는다 */
export const deletePost = (target: Pick<GalleryPreData, "gallery" | "id" | "link">): Promise<ManageResult> =>
    manage(target, "delete_list", {id: target.gallery, "nos[]": target.id});

interface BlockOptions {
    avoidHour: string;
    avoidReason: string;
    avoidReasonTxt: string;
    delChk: "0" | "1";
    userTypeChk: "0" | "1";
}

/** 유저 차단 (관리 팝업/프리셋) */
export const blockUser = (preData: GalleryPreData, options: BlockOptions): Promise<ManageResult> => manage(preData, "update_avoid_list", {
    id: preData.gallery,
    "nos[]": preData.id,
    parent: "",
    avoid_hour: options.avoidHour,
    avoid_reason: options.avoidReason,
    avoid_reason_txt: options.avoidReasonTxt,
    del_chk: options.delChk,
    avoid_type_chk: options.userTypeChk
});

/** 공지 등록/해제 */
export const setNotice = (preData: GalleryPreData, notice: boolean): Promise<ManageResult> =>
    manage(preData, "set_notice", {mode: notice ? "SET" : "REL", id: preData.gallery, no: preData.id});

/** 개념글 등록/해제 */
export const setRecommend = (preData: GalleryPreData, recommend: boolean): Promise<ManageResult> =>
    manage(preData, "set_recommend", {mode: recommend ? "SET" : "REL", id: preData.gallery, "nos[]": preData.id});

/** 이미지 캡챠 URL */
export const captchaImage = (preData: GalleryPreData, type: "comment" | "recommend"): string =>
    `${urls.base}kcaptcha/image_v3/?gall_id=${preData.gallery}&kcaptcha_type=${type}&time=${Date.now()}&_GALLTYPE_=${galleryTypeName(preData.link)}`;

/** 관리자 댓글 삭제 */
export const adminDeleteComment = (preData: GalleryPreData, commentId: string): Promise<ManageResult> =>
    manage(preData, "delete_comment", {id: preData.gallery, pno: preData.id, "cmt_nos[]": commentId});

/** 유저 댓글 삭제 */
export const userDeleteComment = async (preData: GalleryPreData, commentId: string, password: string): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("no", preData.id);
    body.set("re_no", commentId);
    body.set("mode", "del");
    if (password) body.set("re_password", password);
    body.set("g-recaptcha-response", "");

    // 'true'만 성공으로 본다 (v5와 같음). 관리 요청과 달리 응답이 JSON이 아니다
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

/** 댓글/디시콘 작성. 디시 f_submit(null)처럼 첫 전송은 grecaptchaToken 없이 보낸다 */
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
    const form = postInfo.commentForm;

    const code = (() => {
        try {
            // 디시 _d()를 옮긴 것. 알파벳을 섞은 base64를 표준 알파벳으로 바꿔 푼다 (65번째 '='는 채움, 모르는 글자는 버린다)
            const rKey = "yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBs1Ct2D3uE4Fv5G6wHl78xJ9K";
            const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

            const dValue = form.dValue;
            if (!dValue) return null;

            let decoded = atob(dValue.replace(/./g, (c) => b64[rKey.indexOf(c)] ?? ""));
            if (!decoded) return null;

            let fi = parseInt(decoded.slice(0, 1));
            fi = fi > 5 ? fi - 5 : fi + 4;
            decoded = decoded.replace(/^./, fi.toString());

            const service = form.serviceCode;

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
    // service_code를 못 만든 채 보내면 서버가 모호한 오류만 주므로 보내지 않고 알린다
    if (!code) return {result: "false", message: "댓글 폼을 읽지 못했습니다. 원문에서 작성해 주세요."};

    const params = new URLSearchParams();
    params.set("t_vch2", "");
    params.set("t_vch2_chk", "");

    for (const [name, value] of form.fields) {
        if (!["service_code", "gallery_no", "clickbutton"].includes(name)) params.set(name, value);
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

/* ===== 글자콘: 디시 txtcon.js의 입력 규칙 (서버 txtcon_conf와 같다) ===== */

export const TXTCON_BACKGROUNDS = ["3b4890", "b4b4e1", "f5e1f0", "d2f0e6", "ffffff", "333333"];
export const TXTCON_COLORS = ["ffffff", "333333"];

const TXTCON_MAX_LEN = 20;
const TXTCON_MAX_LINES = 4;
/** 한 줄 최대 글자 수 */
const TXTCON_MAX_LINE_LEN = 5;

// 컬러 이모지로 그려지는 BMP 문자. 글자 수에 1을 더 센다
const TXTCON_BMP_EMOJI = /[\p{Emoji_Presentation}--[\u{10000}-\u{10FFFF}]]/gv;

/** 글자 수: UTF-16 코드 유닛 + BMP 컬러 이모지 가산 (줄바꿈 제외) */
const txtconLength = (text: string): number => {
    const plain = text.replaceAll("\n", "");

    return plain.length + (plain.match(TXTCON_BMP_EMOJI)?.length ?? 0);
};

// ponytail: 디시 txtcon_clusters 대신 브라우저 grapheme 분할을 쓴다. 국기·스킨톤·ZWJ 같은 흔한 글자는 결과가 같고, 분해형 한글 자모 등만 다르다
let segmenter: Intl.Segmenter | undefined;
/** 글자콘의 '한 글자'(grapheme) 단위로 나눈다. 모든 디시 페이지에서 만들지 않도록 분할기는 처음 쓸 때 만든다 */
export const graphemes = (text: string): string[] => Array.from((segmenter ??= new Intl.Segmenter()).segment(text), ({segment}) => segment);

/** 직접 넣은 줄바꿈은 두고 각 줄을 5글자씩 나눈다. 입력 제한과 표시(Comment.tsx)가 같이 쓴다 */
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
        // 이모지 구간 밖의 4바이트 문자와 아랍 표현형은 '+'로 바꾼다
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

    // 결과는 4줄×5글자와 줄바꿈 3개, 즉 23 grapheme을 넘을 수 없으니 미리 자른다.
    // 그래야 한 글자씩 빼며 전체를 다시 나누는 아래 루프가 긴 붙여넣기에서 O(n²)가 되지 않는다.
    text = graphemes(text).slice(0, (TXTCON_MAX_LINE_LEN + 1) * TXTCON_MAX_LINES).join("");

    // 5글자씩 나눈 줄 수가 넘치면 뒤에서부터 뺀다
    while (wrapTxtcon(text).split("\n").length > TXTCON_MAX_LINES) text = Array.from(text).slice(0, -1).join("");

    // 20자 제한. 코드포인트 단위로 앞에서부터 채우다가 넘치면 멈춘다.
    // 넘치는 글자만 건너뛰고 계속하면 가운데가 빠지고, 뒤의 ZWJ·결합 문자가 엉뚱한 글자에 붙는다.
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

/** 글자콘 작성 (txtcon.js txtcon_submit). 첫 전송은 grecaptchaToken 없이 보낸다 */
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
    const form = postInfo.commentForm;

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

    for (const [name, value] of Object.entries(form.checks)) body.set(name, value);

    // 갤닉은 댓글(submitComment)처럼 쓰지 않는다
    if (form.gallNickName !== undefined) {
        body.set("gall_nick_name", form.gallNickName);
        body.set("use_gall_nick", "N");
    }

    body.set("g-recaptcha-response", "");
    if (grecaptchaToken) body.set("g-recaptcha-token", grecaptchaToken);

    const response = await ajax.post(urls.txtcon_submit, {body}).text();

    return submitResult(response);
};
