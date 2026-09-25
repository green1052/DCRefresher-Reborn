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

/** 끌올 */
export const bump = async (preData: GalleryPreData): Promise<void> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("nos[]", preData.id);

    await http.post(manageUrl(preData.link, urls.manage.bump, urls.manage.bumpMini), {headers: HEADERS, body});
};

/** 삭제 */
export const deletePost = async (preData: GalleryPreData): Promise<void> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("nos[]", preData.id);

    await http.post(manageUrl(preData.link, urls.manage.delete, urls.manage.deleteMini), {headers: HEADERS, body});
};

export interface BlockOptions {
    avoidHour: string;
    avoidReason: string;
    avoidReasonTxt: string;
    delChk: "0" | "1";
    userTypeChk: "0" | "1";
}

/** 유저 차단 (관리 팝업/프리셋) */
export const blockUser = async (preData: GalleryPreData, options: BlockOptions): Promise<void> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("nos[]", preData.id);
    body.set("parent", "");
    body.set("avoid_hour", options.avoidHour);
    body.set("avoid_reason", options.avoidReason);
    body.set("avoid_reason_txt", options.avoidReasonTxt);
    body.set("del_chk", options.delChk);
    body.set("avoid_type_chk", options.userTypeChk);

    await http.post(manageUrl(preData.link, urls.manage.block, urls.manage.blockMini), {headers: HEADERS, body});
};

/** 공지 등록/해제 */
export const setNotice = async (preData: GalleryPreData, notice: boolean): Promise<void> => {
    const body = await commonBody(preData.link);
    body.set("mode", notice ? "SET" : "REL");
    body.set("id", preData.gallery);
    body.set("no", preData.id);

    await http.post(manageUrl(preData.link, urls.manage.setNotice, urls.manage.setNoticeMini), {
        headers: HEADERS,
        body
    });
};

/** 개념글 등록/해제 */
export const setRecommend = async (preData: GalleryPreData, recommend: boolean): Promise<void> => {
    const body = await commonBody(preData.link);
    body.set("mode", recommend ? "SET" : "REL");
    body.set("id", preData.gallery);
    body.set("nos[]", preData.id);

    await http.post(manageUrl(preData.link, urls.manage.setRecommend, urls.manage.setRecommendMini), {
        headers: HEADERS,
        body
    });
};

/** 이미지 캡챠 URL */
export const captchaImage = (preData: GalleryPreData, type: "comment" | "recommend"): string =>
    `${urls.base}kcaptcha/image_v3/?gall_id=${preData.gallery}&kcaptcha_type=${type}&time=${Date.now()}&_GALLTYPE_=${galleryTypeName(preData.link ?? "")}`;

/** 관리자 댓글 삭제 */
export const adminDeleteComment = async (preData: GalleryPreData, commentId: string): Promise<void> => {
    const body = await commonBody(preData.link);
    body.set("id", preData.gallery);
    body.set("pno", preData.id);
    body.set("cmt_nos[]", commentId);

    await http.post(manageUrl(preData.link, urls.manage.deleteComment, urls.manage.deleteCommentMini), {
        headers: HEADERS,
        body
    });
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

/** 댓글/디시콘 작성 */
export const submitComment = async (
    preData: GalleryPreData,
    user: { name: string; pw?: string },
    postDom: Document,
    memo: string | DcinsideDccon[],
    commentNo: string | null,
    replyNo: string | null,
    bigDccon: boolean,
    captcha?: string,
    grecaptcha?: string
): Promise<{ result: string; message?: string }> => {
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
    if (grecaptcha) params.set("g-recaptcha-response", grecaptcha);

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
    const [result, message] = response.split("||");

    return {result: result ?? "", message};
};
