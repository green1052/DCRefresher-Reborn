import type {PostInfo} from "./types";

/** 본문 이미지의 data-original 복원 (DC지연로딩) */
const restoreImageSources = (dom: Document): void => {
    for (const image of dom.querySelectorAll<HTMLImageElement>("img[data-original]")) {
        if (image.dataset.original) image.src = image.dataset.original;
    }
};

// 받은 HTML에서 바로 찾는다 — dom.body.innerHTML은 본문 전체를 다시 직렬화한다
const parseCommentId = (html: string): string | undefined =>
    html.match(/\$\(document\)\.data\('comment_id',\s+'([^']+)'\);/)?.[1];

const parseCommentNo = (html: string): string | undefined =>
    html.match(/\$\(document\)\.data\('comment_no',\s+'([^']+)'\);/)?.[1];

const parseUser = (dom: Document): PostInfo["user"] => {
    const writer = dom.querySelector<HTMLElement>(".gallview_head > .gall_writer");
    if (!writer) return;

    const {nick, uid, ip} = writer.dataset;
    const icon = writer.querySelector<HTMLImageElement>("img")?.src;

    return {
        nick: nick || undefined,
        id: uid || undefined,
        ip: ip || undefined,
        image: icon
    };
};

const strip = (value: string | undefined | null, ...prefixes: string[]): string | undefined => {
    if (!value) return;

    // 접두어를 뗀 뒤 trim — 먼저 trim하면 '조회 1234'가 ' 1234'로 남는다
    let result = value;
    for (const prefix of prefixes) result = result.replace(prefix, "");
    result = result.trim();

    return result || undefined;
};

/** 본문 HTML → PostInfo. 비정상 문서면 undefined */
export const parsePostInfo = (html: string): PostInfo | undefined => {
    const dom = new DOMParser().parseFromString(html, "text/html");

    if (!dom.querySelector(".gallview_head, .writing_view_box, .title_subject")) return;

    restoreImageSources(dom);
    // 본문 위 짤방(갤러리 기본 이미지)·광고 자리 — 글 내용이 아니다
    for (const element of dom.querySelectorAll(".writing_view_box #zzbang_div, .writing_view_box #ad_nv_slot")) element.remove();

    // 제목 안 <script>의 글자가 textContent에 섞이므로 먼저 지운다 (75471b72) — 말머리와 같은 평문으로 맞춰 화면에서 텍스트로 넣는다
    const subject = dom.querySelector<HTMLElement>(".title_subject");
    for (const script of subject?.querySelectorAll("script") ?? []) script.remove();

    const header = strip(dom.querySelector<HTMLElement>(".title_headtext")?.textContent?.replace(/^\[|\]$/g, ""));
    const commentCountText = strip(dom.querySelector<HTMLElement>(".gall_comment")?.textContent?.trim().split(" ")[1]);

    return {
        header,
        title: strip(subject?.textContent),
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
        commentId: parseCommentId(html),
        commentNo: parseCommentNo(html),
        // 0도 살린다 — '댓글 0개면 요청 생략'이 0으로 판단한다
        commentCount: commentCountText && /^\d+$/.test(commentCountText) ? Number(commentCountText) : undefined,
        requireCaptcha: Boolean(dom.querySelector(".recommend_kapcode")),
        requireCommentCaptcha: Boolean(dom.querySelector<HTMLInputElement>(".cmt_write_box input[name=comment_code]")),
        v_cur_t: dom.querySelector<HTMLInputElement>("input[name=v_cur_t]")?.value,
        randomParam: (() => {
            const input = dom.querySelector<HTMLInputElement>("#adult_article + input");
            return input?.name ? {name: input.name, value: input.value} : undefined;
        })(),
        dom
    };
};
