import {http} from "@/core/http/client";
import {galleryPath, galleryTypeName, isMiniGallery, urls} from "@/core/http/urls";
import {csrfToken} from "@/utils/cookie";

import {parsePostInfo} from "./parser";
import type {CommentListResponse, DcinsideComment, DcinsideDccon, GalleryPreData, PostInfo} from "./types";

const HEADERS = {"X-Requested-With": "XMLHttpRequest"};

const commonBody = async (link?: string): Promise<URLSearchParams> =>
    new URLSearchParams({ci_t: await csrfToken(), _GALLTYPE_: galleryTypeName(link ?? "")});

const isMini = (link?: string): boolean => isMiniGallery(link ?? "");

const viewUrl = (link: string | undefined, gallery: string, id: string): string => {
    const type = galleryPath(link ?? "");

    return `${urls.base}${type}board/view/?id=${gallery}&no=${id}`;
};

/** 게시글 HTML → PostInfo */
export const fetchPost = async (preData: GalleryPreData, signal: AbortSignal): Promise<PostInfo> => {
    const response = await http.get(viewUrl(preData.link, preData.gallery, preData.id), {signal}).text();

    const postInfo = parsePostInfo(response, preData.id);
    if (!postInfo) throw new Error("404");

    return postInfo;
};

/** 댓글 목록 (1회 전체) */
export const fetchComments = async (preData: GalleryPreData, postInfo: PostInfo, signal: AbortSignal): Promise<CommentListResponse> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("no", preData.id);
    body.set("cmt_id", postInfo.commentId ?? preData.gallery);
    body.set("cmt_no", postInfo.commentNo ?? preData.id);
    body.set("e_s_n_o", postInfo.dom?.querySelector<HTMLInputElement>("#e_s_n_o")?.value ?? "");
    body.set("comment_page", "1");

    const response = await http.post(urls.comments, {headers: HEADERS, body, signal}).json<{
        comments: DcinsideComment[] | null;
        total_cnt: number | string
    }>();

    return {total_cnt: Number(response.total_cnt), list: response.comments ?? []};
};

export interface VoteResult {
    success: boolean;
    counts?: string;
    fixedCounts?: string;
}

/** 추천/비추천. 3시간 쿠키(Firstcheck)로 중복 방지 */
export const vote = async (preData: GalleryPreData, postInfo: PostInfo, mode: "U" | "D", code?: string): Promise<VoteResult> => {
    const cookieName = `${preData.gallery}${preData.id}_Firstcheck${mode === "U" ? "" : "_down"}`;

    if (await cookieStore.get(cookieName)) return {success: false};

    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("no", preData.id);
    body.set("mode", mode);
    body.set("code_recommend", code ?? postInfo.dom?.querySelector<HTMLInputElement>("input[name=code_recommend]")?.value ?? "");
    body.set("link_id", preData.gallery);
    if (postInfo.v_cur_t) body.set("v_cur_t", postInfo.v_cur_t);
    if (postInfo.randomParam) body.set(postInfo.randomParam.name, postInfo.randomParam.value);

    const response = await http.post(urls.vote, {headers: HEADERS, body}).text();
    const [result, counts, fixedCounts] = response.split("||");

    if (result === "SUCCESS") {
        await cookieStore.set({name: cookieName, value: "Y", expires: Date.now() + 3 * 3600_000, path: "/"});

        return {success: true, counts, fixedCounts};
    }

    return {success: false};
};

const manageUrl = (link: string | undefined, base: string, mini: string): string => (isMini(link) ? mini : base);

/** 관리 요청 결과 — 디시 관리 API는 {"result": "success" | "fail", "msg": "…"}를 돌려준다 */
export interface ManageResult {
    success: boolean;
    /** 디시가 준 안내 문구 (없을 수 있음) */
    message?: string;
}

export const postManage = async (url: string, body: URLSearchParams): Promise<ManageResult> => {
    const text = (await http.post(url, {headers: HEADERS, body}).text()).trim();

    try {
        const {result, msg} = JSON.parse(text) as { result?: unknown; msg?: unknown };
        return {success: result !== "fail" && result !== false && result !== "false", message: typeof msg === "string" && msg ? msg : undefined};
    } catch {
        // JSON이 아니면 "false||메시지" 같은 텍스트
        const [result, message] = text.split("||");
        return {success: result !== "false" && result !== "fail", message: message || undefined};
    }
};

/** 끌올 */
export const bump = async (preData: GalleryPreData): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("nos[]", preData.id);

    return postManage(manageUrl(preData.link, urls.manage.bump, urls.manage.bumpMini), body);
};

/** 삭제 */
export const deletePost = async (preData: GalleryPreData): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("nos[]", preData.id);

    return postManage(manageUrl(preData.link, urls.manage.delete, urls.manage.deleteMini), body);
};

export interface BlockOptions {
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
    `${urls.base}kcaptcha/image_v3/?gall_id=${preData.gallery}&kcaptcha_type=${type}&time=${Date.now()}&_GALLTYPE_=${galleryTypeName(preData.link ?? "")}`;

/** 관리자 댓글 삭제 */
export const adminDeleteComment = async (preData: GalleryPreData, commentId: string): Promise<ManageResult> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("pno", preData.id);
    body.set("cmt_nos[]", commentId);

    return postManage(manageUrl(preData.link, urls.manage.deleteComment, urls.manage.deleteCommentMini), body);
};

/** 유저 댓글 삭제 */
export const userDeleteComment = async (preData: GalleryPreData, commentId: string, password: string): Promise<void> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("no", preData.id);
    body.set("re_no", commentId);
    body.set("mode", "del");
    if (password) body.set("re_password", password);
    body.set("g-recaptcha-response", "");

    await http.post(urls.comment_remove, {headers: HEADERS, body});
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
    user: { name: string; pw?: string },
    postDom: Document,
    memo: string | DcinsideDccon[],
    commentNo: string | null,
    replyNo: string | null,
    bigDccon: boolean,
    captcha?: string,
    grecaptchaToken?: string
): Promise<SubmitResult> => {
    const dom = postDom;

    const code = (() => {
        try {
            const rKey = "yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBs1Ct2D3uE4Fv5G6wHl78xJ9K";
            const rRegex = /[^A-Za-z0-9+/=]/g;

            const decode = (r: string): string => {
                let output = "";
                let cursor = 0;

                r = r.replace(rRegex, "");

                while (cursor < r.length) {
                    const t = rKey.indexOf(r.charAt(cursor++));
                    const f = rKey.indexOf(r.charAt(cursor++));
                    const d = rKey.indexOf(r.charAt(cursor++));
                    const h = rKey.indexOf(r.charAt(cursor++));
                    const a = (t << 2) | (f >> 4);
                    const e = ((15 & f) << 4) | (d >> 2);
                    const n = ((3 & d) << 6) | h;

                    output += String.fromCharCode(a);
                    if (d !== 64) output += String.fromCharCode(e);
                    if (h !== 64) output += String.fromCharCode(n);
                }

                return output;
            };

            const script = dom.querySelector<HTMLElement>("#reply-setting-tmpl + script");
            const dValue = script?.textContent?.match(/_d\('(.*)'\)/)?.[1];
            if (!dValue) throw new Error("_d 값을 찾을 수 없습니다.");

            let decoded = decode(dValue);
            if (!decoded) throw new Error("_r이 비정상적으로 디코딩되었습니다.");

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
        } catch (error) {
            return error instanceof Error ? `PreNotWorking: ${error.message}` : "PreNotWorking";
        }
    })();

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

    const response = await http.post(typeof memo === "string" ? urls.comments_submit : urls.dccon_comments_submit, {
        headers: HEADERS,
        body: params
    }).text();

    return submitResult(response);
};

/* ===== 글자콘 — 디시 txtcon.js의 입력 규칙 (서버 txtcon_conf와 같다) ===== */

export const TXTCON_BACKGROUNDS = ["3b4890", "b4b4e1", "f5e1f0", "d2f0e6", "ffffff", "333333"];
export const TXTCON_COLORS = ["ffffff", "333333"];

const TXTCON_MAX_LEN = 20;
const TXTCON_MAX_LINES = 4;
const TXTCON_MAX_LINE_LEN = 5;

// 컬러 이모지로 그려지는 BMP 문자 — 글자 수에 1을 더 센다
const TXTCON_BMP_EMOJI = /[\u231A-\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD-\u25FE\u2614-\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA-\u26AB\u26BD-\u26BE\u26C4-\u26C5\u26CE\u26D4\u26EA\u26F2-\u26F3\u26F5\u26FA\u26FD\u2705\u270A-\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B-\u2B1C\u2B50\u2B55]/g;

/** 글자 수: UTF-16 코드 유닛 + BMP 컬러 이모지 가산 (줄바꿈 제외) */
const txtconLength = (text: string): number => {
    const plain = text.replaceAll("\n", "");

    return plain.length + (plain.match(TXTCON_BMP_EMOJI)?.length ?? 0);
};

// ponytail: 디시 txtcon_clusters 대신 브라우저 grapheme 분할 — 흔한 글자에선 같다 (분해형 한글 자모 등만 다름)
const segmenter = new Intl.Segmenter();

/** 각 줄을 5글자씩 나눴을 때의 줄 수 */
const txtconLines = (text: string): number =>
    text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(segmenter.segment(line)).length / TXTCON_MAX_LINE_LEN)), 0);

/** 글자콘 입력값 정리 (txtcon.js 'wide' 문자 필터 + 20자·4줄·줄당 5자 제한) */
export const normalizeTxtcon = (value: string): string => {
    let text = value
        .replace(/\r\n?/g, "\n")
        // 이모지 구간 밖 4바이트·아랍 표현형은 '+'
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, (pair) => {
            const cp = pair.codePointAt(0) ?? 0;
            return cp >= 0x1F000 && cp <= 0x1FAFF ? pair : "+";
        })
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

    // 5글자씩 나눈 줄 수가 넘치면 뒤에서부터 제거
    while (txtconLines(text) > TXTCON_MAX_LINES) text = Array.from(text).slice(0, -1).join("");

    // 글자 수 제한 (코드포인트 단위로 자른다)
    let count = 0;
    let output = "";
    for (const char of text) {
        const width = txtconLength(char);
        if (count + width > TXTCON_MAX_LEN) continue;

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
    const dom = postInfo.dom ?? document;

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

    const response = await http.post(urls.txtcon_submit, {headers: HEADERS, body}).text();

    return submitResult(response);
};
