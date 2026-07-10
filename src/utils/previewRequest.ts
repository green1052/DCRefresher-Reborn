import Cookies from "js-cookie";
import ky, {Input, Options} from "ky";

import * as http from "./http";
import {contentFetch} from "./httpClient";
import {parsePostInfo} from "./postParser";

export interface GalleryHTTPRequestArguments {
    gallery: string;
    id: string;
    commentId?: string;
    commentNo?: string;
    link?: string;
}

const kyClient = ky.create({
    method: "POST",
    headers: {
        "X-Requested-With": "XMLHttpRequest"
    },
    fetch: contentFetch
});

const client = (url: Input, options?: Options): Promise<string> => {
    return kyClient(url, options).text();
};

const parseJsonSafely = (response: string): unknown => {
    try {
        return JSON.parse(response);
    } catch {
        return response;
    }
};

export const previewRequest = {
    async bump(args: GalleryHTTPRequestArguments) {
        const galleryType = http.galleryType(location.href, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", args.gallery);
        params.set("nos[]", args.id);
        params.set("_GALLTYPE_", http.galleryTypeName(location.href));

        const response = await client(galleryType === "mini/" ? http.urls.manage.bumpMini : http.urls.manage.bump, {
            body: params
        });

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
    ) {
        Cookies.set(`${gallId}${postId}_Firstcheck${type ? "" : "_down"}`, "Y", {
            path: "/",
            domain: "dcinside.com",
            expires: new Date(Date.now() + 3 * 60 * 60 * 1000)
        });

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");

        if (vCurT) params.set("v_cur_t", vCurT);
        if (randomParam) params.set(randomParam.name, randomParam.value);

        params.set("id", gallId);
        params.set("no", postId);
        params.set("mode", type ? "U" : "D");
        params.set("code_recommend", code ?? "");
        params.set("_GALLTYPE_", http.galleryTypeName(link));
        params.set("link_id", gallId);

        const response = await client(http.urls.vote, {body: params});

        const [result, counts, fixedCounts] = response.split("||");

        return {result, counts, fixedCounts};
    },

    async post(link: string, gallery: string, id: string, signal: AbortSignal): Promise<IPostInfo> {
        const response = await ky
            .get(`${http.urls.base}${http.galleryType(link, "/")}${http.urls.view}${gallery}&no=${id}`, {signal})
            .text();
        return parsePostInfo(id, response);
    },

    async comments(args: GalleryHTTPRequestArguments, signal: AbortSignal) {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const params = new URLSearchParams();
        params.set("id", args.gallery);
        params.set("no", args.id);
        params.set("cmt_id", args.commentId ?? args.gallery);
        params.set("cmt_no", args.commentNo ?? args.id);
        params.set("e_s_n_o", document.querySelector<HTMLInputElement>("#e_s_n_o")?.value ?? "");
        params.set("comment_page", "1");
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await client(http.urls.comments, {body: params, signal});

        return JSON.parse(response);
    },

    async delete(args: GalleryHTTPRequestArguments, password?: string) {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", args.gallery);
        params.set("nos[]", args.id);
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await client(galleryType === "mini/" ? http.urls.manage.deleteMini : http.urls.manage.delete, {
            body: params
        });

        return parseJsonSafely(response);
    },

    async block(
        args: GalleryHTTPRequestArguments,
        avoidHour: number,
        avoidReason: number,
        avoidReasonTxt: string,
        delChk: number,
        userType: number
    ) {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", args.gallery);
        params.set("nos[]", args.id);
        params.set("parent", "");
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));
        params.set("avoid_hour", avoidHour.toString());
        params.set("avoid_reason", avoidReason.toString());
        params.set("avoid_reason_txt", avoidReasonTxt);
        params.set("del_chk", delChk.toString());
        params.set("avoid_type_chk", userType.toString());

        const response = await client(galleryType === "mini/" ? http.urls.manage.blockMini : http.urls.manage.block, {
            body: params
        });

        return parseJsonSafely(response);
    },

    async setNotice(
        args: GalleryHTTPRequestArguments,
        set: boolean
    ): Promise<string | {msg: string; result: "success" | "fail"}> {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("mode", set ? "SET" : "REL");
        params.set("id", args.gallery);
        params.set("no", args.id);
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));

        const response = await client(
            galleryType === "mini/" ? http.urls.manage.setNoticeMini : http.urls.manage.setNotice,
            {body: params}
        );

        return parseJsonSafely(response) as string | {msg: string; result: "success" | "fail"};
    },

    async setRecommend(
        args: GalleryHTTPRequestArguments,
        set: boolean
    ): Promise<string | {msg: string; result: "success" | "fail"}> {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const galleryType = http.galleryType(args.link, "/");

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", args.gallery);
        params.set("_GALLTYPE_", http.galleryTypeName(args.link));
        params.set("mode", set ? "SET" : "REL");
        params.set("nos[]", args.id);

        const response = await client(
            galleryType === "mini/" ? http.urls.manage.setRecommendMini : http.urls.manage.setRecommend,
            {body: params}
        );

        return parseJsonSafely(response) as string | {msg: string; result: "success" | "fail"};
    },

    async captcha(args: GalleryHTTPRequestArguments, kcaptchaType: "comment" | "recommend") {
        if (!args.link) throw new Error("link 값이 주어지지 않았습니다. (확장 프로그램 오류)");

        const galleryTypeName = http.galleryTypeName(args.link);

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("gall_id", args.gallery);
        params.set("kcaptcha_type", kcaptchaType);
        params.set("_GALLTYPE_", galleryTypeName);

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

        const typeName = http.galleryTypeName(preData.link);
        if (!typeName.length) return false;

        const url = http.checkMini(preData.link) ? http.urls.manage.deleteCommentMini : http.urls.manage.deleteComment;

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", preData.gallery);
        params.set("_GALLTYPE_", typeName);
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

        const typeName = http.galleryTypeName(preData.link);
        if (!typeName.length) return false;

        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("id", preData.gallery);
        params.set("re_no", commentId);
        params.set("mode", "del");
        params.set("g-recaptcha-response", "");
        params.set("_GALLTYPE_", typeName);
        params.set("no", preData.id);

        if (password) {
            params.set("re_password", password);
        }

        return client(http.urls.comment_remove, {body: params, signal}).catch(() => false);
    }
};

export type PreviewRequest = typeof previewRequest;