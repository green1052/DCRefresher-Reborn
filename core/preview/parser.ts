import type {PostInfo} from "./types";

/** 본문 이미지의 data-original 복원 (DC지연로딩). 관리자가 가린 이미지(data-block)는 '차단 이미지 보기'를 누를 때 넣는다 (Frame.tsx) */
const restoreImageSources = (dom: Document): void => {
    for (const image of dom.querySelectorAll<HTMLImageElement>("img[data-original]:not([data-block])")) {
        if (image.dataset.original) image.src = image.dataset.original;
    }
};

// 디시 스크립트에서만 찾는다 — 본문이 스크립트보다 앞이라 원본 HTML 전체에서 찾으면 본문에 적은 글자가 먼저 걸린다
const parseCommentIds = (dom: Document): { commentId?: string; commentNo?: string } => {
    const scripts = Array.from(dom.scripts, (script) => script.textContent).join("\n");

    return {
        commentId: scripts.match(/\$\(document\)\.data\('comment_id',\s+'([^']+)'\);/)?.[1],
        commentNo: scripts.match(/\$\(document\)\.data\('comment_no',\s+'([^']+)'\);/)?.[1]
    };
};

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

/** 성인 인증이 필요한 글일 때 parsePostInfo가 던지는 Error의 message */
export const ADULT_ERROR = "adult";

/**
 * 성인 인증 안내 — 미인증이면 본문 대신 /error/adult/로 보내는 스크립트가 오고, 리다이렉트를 따라가면 인증 페이지(.adult_certify)가 온다.
 * 본문이 없을 때만 본다 (본문 글자에 주소가 섞여도 오인하지 않게)
 */
const isAdultPage = (html: string, dom: Document): boolean => html.includes("/error/adult") || dom.querySelector(".adult_certify") !== null;

/** 본문 HTML → PostInfo. 비정상 문서면 undefined, 성인 인증이 필요하면 Error(ADULT_ERROR) */
export const parsePostInfo = (html: string): PostInfo | undefined => {
    const dom = new DOMParser().parseFromString(html, "text/html");

    if (!dom.querySelector(".gallview_head, .writing_view_box, .title_subject")) {
        // undefined면 fetchPost가 삭제된 글(404)로 보므로 따로 던진다
        if (isAdultPage(html, dom)) throw new Error(ADULT_ERROR);
        return;
    }

    restoreImageSources(dom);
    // 본문 위 짤방(갤러리 기본 이미지)·광고 자리 — 글 내용이 아니다
    for (const element of dom.querySelectorAll(".writing_view_box #zzbang_div, .writing_view_box #ad_nv_slot")) element.remove();

    // 제목 안 <script>의 글자가 textContent에 섞이므로 먼저 지운다 (75471b72) — 말머리와 같은 평문으로 맞춰 화면에서 텍스트로 넣는다
    const subject = dom.querySelector<HTMLElement>(".title_subject");
    for (const script of subject?.querySelectorAll("script") ?? []) script.remove();

    const header = strip(dom.querySelector<HTMLElement>(".title_headtext")?.textContent?.replace(/^\[|\]$/g, ""));
    const commentCountText = strip(dom.querySelector<HTMLElement>(".gall_comment")?.textContent?.trim().split(" ")[1]);
    // 글 머리의 작성 시각 — title("2026-09-26 02:29:40")이 없으면 글자("2026.09.26 02:29:40")
    const date = dom.querySelector<HTMLElement>(".gallview_head .gall_date");

    return {
        header,
        title: strip(subject?.textContent),
        expire: strip(
            dom.querySelector<HTMLElement>(".view_content_wrap div.fl > span.mini_autodeltime > div.pop_tipbox > div")?.textContent,
            " 자동 삭제"
        ),
        date: strip(date?.title || date?.textContent),
        user: parseUser(dom),
        views: strip(dom.querySelector<HTMLElement>(".fr > .gall_count")?.textContent, "조회"),
        upvotes: strip(dom.querySelector<HTMLElement>(".fr > .gall_reply_num")?.textContent, "추천"),
        fixedUpvotes: strip(dom.querySelector<HTMLElement>(".sup_num > .smallnum")?.textContent),
        downvotes: strip(dom.querySelector<HTMLElement>(".btn_recommend_box .down_num")?.textContent),
        contents: dom.querySelector<HTMLElement>(".writing_view_box")?.innerHTML,
        ...parseCommentIds(dom),
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
