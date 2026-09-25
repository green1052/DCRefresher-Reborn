import {sanitizeHtml} from "@/utils/sanitize";
import {getType} from "@/utils/user";

import type {PostInfo} from "./types";

/** 본문 이미지의 data-original 복원 (DC지연로딩) */
const restoreImageSources = (dom: Document): void => {
    for (const image of dom.querySelectorAll<HTMLImageElement>("img[data-original]")) {
        if (image.dataset.original) image.src = image.dataset.original;
    }
};

const parseCommentId = (dom: Document): string | undefined =>
    dom.body.innerHTML.match(/\$\(document\)\.data\('comment_id',\s+'([^']+)'\);/)?.[1];

const parseCommentNo = (dom: Document): string | undefined =>
    dom.body.innerHTML.match(/\$\(document\)\.data\('cmt_no',\s+'([^']+)'\);/)?.[1];

const parseUser = (dom: Document): PostInfo["user"] => {
    const writer = dom.querySelector<HTMLElement>(".gallview_head > .gall_writer");
    if (!writer) return;

    const {nick, uid, ip} = writer.dataset;
    const icon = writer.querySelector<HTMLImageElement>("img")?.src;

    return {
        nick: nick || undefined,
        id: uid || undefined,
        ip: ip || undefined,
        Type: icon ? getType(icon) : undefined,
        image: icon
    };
};

const strip = (value: string | undefined | null, ...prefixes: string[]): string | undefined => {
    if (!value) return;

    let result = value.trim();
    for (const prefix of prefixes) result = result.replace(prefix, "");

    return result || undefined;
};

/** 본문 HTML → PostInfo. 비정상 문서면 undefined */
export const parsePostInfo = (html: string, id: string): PostInfo | undefined => {
    const dom = new DOMParser().parseFromString(html, "text/html");

    if (!dom.querySelector(".gallview_head, .writing_view_box, .title_subject")) return;

    restoreImageSources(dom);

    const header = strip(dom.querySelector<HTMLElement>(".title_headtext")?.textContent?.replace(/^\[|\]$/g, ""));
    const commentCountText = strip(dom.querySelector<HTMLElement>(".gall_comment")?.textContent?.trim().split(" ")[1]);

    return {
        id,
        header,
        title: strip(sanitizeHtml(dom.querySelector<HTMLElement>(".title_subject")?.innerHTML ?? "")),
        date: strip(dom.querySelector<HTMLElement>(".fl > .gall_date")?.textContent),
        expire: strip(
            dom.querySelector<HTMLElement>(".view_content_wrap div.fl > span.mini_autodeltime > div.pop_tipbox > div")?.textContent,
            " 자동 삭제"
        ),
        user: parseUser(dom),
        views: strip(dom.querySelector<HTMLElement>(".fr > .gall_count")?.textContent, "조회"),
        upvotes: strip(dom.querySelector<HTMLElement>(".fr > .gall_reply_num")?.textContent, "추천"),
        fixedUpvotes: strip(dom.querySelector<HTMLElement>(".sup_num > .smallnum")?.textContent),
        downvotes: strip(dom.querySelector<HTMLElement>(".btn_recommend_box .down_num")?.textContent),
        contents: dom.querySelector<HTMLElement>(".writing_view_box")?.innerHTML,
        commentId: parseCommentId(dom),
        commentNo: parseCommentNo(dom),
        commentCount: commentCountText ? Number(commentCountText) || undefined : undefined,
        isAdult: Boolean(dom.querySelector("a[href*='/error/adult']")),
        requireCaptcha: Boolean(dom.querySelector(".recommend_kapcode")),
        requireCommentCaptcha: Boolean(dom.querySelector<HTMLInputElement>(".cmt_write_box input[name=comment_code]")),
        disabledDownvote: !dom.querySelector(".btn_recommend_box .down_num"),
        v_cur_t: dom.querySelector<HTMLInputElement>("input[name=v_cur_t]")?.value,
        randomParam: (() => {
            const input = dom.querySelector<HTMLInputElement>("#adult_article + input");
            return input?.name ? {name: input.name, value: input.value} : undefined;
        })(),
        dom
    };
};
