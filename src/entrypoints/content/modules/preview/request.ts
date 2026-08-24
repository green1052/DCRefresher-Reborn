import Cookies from "js-cookie";
import type {Input, Options} from "ky";

import {ajaxClient, client as htmlClient} from "@/http/http";
import * as http from "@/http/http";
import toast from "@/utils/toast";
import {parsePostInfo} from "./postParser";
import {PostCache} from "./cache";

export interface GalleryHTTPRequestArguments {
    gallery: string;
    id: string;
    commentId?: string;
    commentNo?: string;
    link?: string;
}

interface VoteResponse {
    result: string;
    counts: string;
    fixedCounts: string;
}

interface ManagementResponse {
    msg: string;
    result: "success" | "fail";
}

const client = (url: Input, options?: Options): Promise<string> => {
    return ajaxClient(url, options).text();
};

const parseJsonSafely = (response: string): unknown => {
    try {
        return JSON.parse(response);
    } catch {
        return response;
    }
};

const isManagementResponse = (value: unknown): value is ManagementResponse => {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as ManagementResponse).msg === "string" &&
        ((value as ManagementResponse).result === "success" || (value as ManagementResponse).result === "fail")
    );
};

// 관리 API 응답({msg, result} 또는 문자열)을 토스트로 표시. 성공 시 onSuccess 실행.
export const handleManageResponse = (response: unknown, onSuccess?: () => void): void => {
    if (typeof response === "object" && response !== null) {
        const r = response as { msg: string; result: string };
        if (r.result === "success") {
            toast.show(r.msg);
            onSuccess?.();
        } else {
            toast.show(r.msg, "error");
        }
        return;
    }

    toast.show(String(response), "error");
};

const requireLink = (args: GalleryHTTPRequestArguments): string => {
    if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");
    return args.link;
};

const manageAction = async (
    args: GalleryHTTPRequestArguments,
    set: boolean,
    idParam: string,
    miniUrl: string,
    normalUrl: string
): Promise<string | ManagementResponse> => {
    const link = requireLink(args);

    const params = http.createAuthParams(link);
    params.set("mode", set ? "SET" : "REL");
    params.set("id", args.gallery);
    params.set(idParam, args.id);

    const response = await client(http.manageUrl(link, miniUrl, normalUrl), {body: params});

    const parsed = parseJsonSafely(response);
    if (isManagementResponse(parsed)) return parsed;
    return String(parsed);
};

export const previewRequest = {
    async bump(args: GalleryHTTPRequestArguments): Promise<unknown> {
        const params = http.createAuthParams(location.href);
        params.set("id", args.gallery);
        params.set("nos[]", args.id);

        const response = await client(
            http.manageUrl(location.href, http.urls.manage.bumpMini, http.urls.manage.bump),
            {body: params}
        );

        return parseJsonSafely(response);
    },

    async vote(
        gallId: string,
        postId: string,
        type: number,
        code: string | undefined,
        link: string,
        vCurT?: string,
        randomParam?: { name: string; value: string }
    ): Promise<VoteResponse> {
        Cookies.set(`${gallId}${postId}_Firstcheck${type ? "" : "_down"}`, "Y", {
            path: "/",
            domain: "dcinside.com",
            expires: new Date(Date.now() + 3 * 60 * 60 * 1000)
        });

        const params = http.createAuthParams(link);

        if (vCurT) params.set("v_cur_t", vCurT);
        if (randomParam) params.set(randomParam.name, randomParam.value);

        params.set("id", gallId);
        params.set("no", postId);
        params.set("mode", type ? "U" : "D");
        params.set("code_recommend", code ?? "");
        params.set("link_id", gallId);

        const response = await client(http.urls.vote, {body: params});

        const [result, counts, fixedCounts] = response.split("||");

        return {result, counts, fixedCounts};
    },

    async post(link: string, gallery: string, id: string, signal: AbortSignal): Promise<IPostInfo> {
        const response = await htmlClient
            .get(`${http.urls.base}${http.galleryType(link, "/")}${http.urls.view}${gallery}&no=${id}`, {signal})
            .text();
        return parsePostInfo(id, response);
    },

    async comments(args: GalleryHTTPRequestArguments, signal: AbortSignal): Promise<DcinsideComments> {
        const link = requireLink(args);

        const params = http.createAuthParams(link);
        params.set("id", args.gallery);
        params.set("no", args.id);
        params.set("cmt_id", args.commentId ?? args.gallery);
        params.set("cmt_no", args.commentNo ?? args.id);
        params.set("e_s_n_o", document.querySelector<HTMLInputElement>("#e_s_n_o")?.value ?? "");
        params.set("comment_page", "1");

        const response = await client(http.urls.comments, {body: params, signal});

        const parsed = parseJsonSafely(response);
        if (typeof parsed !== "object" || parsed === null) {
            throw new Error("댓글 데이터를 불러오지 못했습니다.");
        }

        return parsed as DcinsideComments;
    },

    async delete(args: GalleryHTTPRequestArguments): Promise<unknown> {
        const link = requireLink(args);

        const params = http.createAuthParams(link);
        params.set("id", args.gallery);
        params.set("nos[]", args.id);

        const response = await client(
            http.manageUrl(link, http.urls.manage.deleteMini, http.urls.manage.delete),
            {body: params}
        );

        return parseJsonSafely(response);
    },

    async block(
        args: GalleryHTTPRequestArguments,
        avoidHour: number,
        avoidReason: number,
        avoidReasonTxt: string,
        delChk: number,
        userType: number
    ): Promise<unknown> {
        const link = requireLink(args);

        const params = http.createAuthParams(link);
        params.set("id", args.gallery);
        params.set("nos[]", args.id);
        params.set("parent", "");
        params.set("avoid_hour", avoidHour.toString());
        params.set("avoid_reason", avoidReason.toString());
        params.set("avoid_reason_txt", avoidReasonTxt);
        params.set("del_chk", delChk.toString());
        params.set("avoid_type_chk", userType.toString());

        const response = await client(
            http.manageUrl(link, http.urls.manage.blockMini, http.urls.manage.block),
            {body: params}
        );

        return parseJsonSafely(response);
    },

    async setNotice(
        args: GalleryHTTPRequestArguments,
        set: boolean
    ): Promise<string | ManagementResponse> {
        return manageAction(args, set, "no", http.urls.manage.setNoticeMini, http.urls.manage.setNotice);
    },

    async setRecommend(
        args: GalleryHTTPRequestArguments,
        set: boolean
    ): Promise<string | ManagementResponse> {
        return manageAction(args, set, "nos[]", http.urls.manage.setRecommendMini, http.urls.manage.setRecommend);
    },

    async captcha(args: GalleryHTTPRequestArguments, kcaptchaType: "comment" | "recommend"): Promise<string> {
        const link = requireLink(args);

        const galleryTypeName = http.galleryTypeName(link);

        return (
            "/kcaptcha/image_v3/?gall_id=" +
            args.gallery +
            "&kcaptcha_type=" +
            kcaptchaType +
            "&time=" +
            Date.now() +
            "&_GALLTYPE_=" +
            galleryTypeName
        );
    },

    async adminDeleteComment(
        preData: GalleryPreData,
        commentId: string,
        signal: AbortSignal
    ): Promise<boolean | string> {
        if (!preData.link) return false;

        const url = http.checkMini(preData.link) ? http.urls.manage.deleteCommentMini : http.urls.manage.deleteComment;

        const params = http.createAuthParams(preData.link);
        params.set("id", preData.gallery);
        params.set("pno", preData.id);
        params.set("cmt_nos[]", commentId);

        return client(url, {body: params, signal}).catch(() => false);
    },

    async userDeleteComment(
        preData: GalleryPreData,
        commentId: string,
        signal: AbortSignal,
        password?: string
    ): Promise<boolean | string> {
        if (!preData.link) return false;

        const params = http.createAuthParams(preData.link);
        params.set("id", preData.gallery);
        params.set("re_no", commentId);
        params.set("mode", "del");
        params.set("g-recaptcha-response", "");
        params.set("no", preData.id);

        if (password) {
            params.set("re_password", password);
        }

        return client(http.urls.comment_remove, {body: params, signal}).catch(() => false);
    }
};

export type PreviewRequest = typeof previewRequest;

// 게시글 조회 (캐시 우선). bodyFrame/miniPreview 공용.
export async function fetchPostWithCache(
    postCaches: PostCache,
    preData: GalleryPreData,
    signal: AbortSignal,
    useCache: boolean
): Promise<IPostInfo> {
    const cacheKey = PostCache.key(preData.gallery, preData.id);

    if (useCache) {
        const cached = postCaches.get(cacheKey)?.post;
        if (cached) return cached;
    }

    const response = await previewRequest.post(preData.link ?? "", preData.gallery, preData.id, signal);

    if (!response) throw new Error("Can not fetch post data.");

    postCaches.set(cacheKey, {date: Date.now(), post: response});

    return response;
}