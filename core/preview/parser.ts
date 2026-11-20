import type {CommentForm, PostInfo, TurnstileConfig} from "./types";

/** data-original을 src로 옮긴다. data-block은 가림 버튼이 쓰니 건드리지 않는다. */
const restoreImageSources = (dom: Document): void => {
    for (const image of dom.querySelectorAll<HTMLImageElement>("img[data-original]:not([data-block])")) {
        if (image.dataset.original) image.src = image.dataset.original;
    }

    // imgPop 주소는 정화에서 빠지므로 data-pop으로 옮겨 둔다.
    for (const image of dom.querySelectorAll<HTMLImageElement>("img[onclick*='imgPop']")) {
        const url = image.getAttribute("onclick")?.match(/imgPop\('([^']+)'/)?.[1];
        if (url) image.dataset.pop = url;
    }
};

/** 디시가 번호를 다는 본문 미디어. */
export const NUMBERED_SOURCE = /dcimg\d\.dcinside\.(com|co\.kr)\/viewimage\.php/;

/** 미디어에 디시처럼 번호를 단다. img_numbering 쿠키를 따른다. */
const numberImages = (dom: Document): void => {
    if ((/(?:^|; )img_numbering=([^;]*)/.exec(document.cookie)?.[1] || "1") !== "1") return;

    const media = Array.from(dom.querySelectorAll<HTMLElement>(".writing_view_box :is(img, video):not(.og-img)"))
        .filter((element) => NUMBERED_SOURCE.test(element.getAttribute("src") || element.dataset.original || element.dataset.src || ""));
    if (media.length < 3) return;

    for (const [index, element] of media.entries()) {
        const wrap = dom.createElement("span");
        wrap.className = "refresher-imgnum";
        wrap.dataset.num = String(index + 1);
        element.replaceWith(wrap);
        wrap.append(element);
    }
};

// 스크립트 안에서만, 스크립트마다 찾는다(본문의 같은 글자가 먼저 걸리지 않게, 전체 문자열을 붙잡지 않게).
const findInScripts = (dom: Document, pattern: RegExp): string | undefined => {
    for (const script of dom.scripts) {
        const found = pattern.exec(script.textContent)?.[1];
        if (found !== undefined) return found;
    }
};

const parseCommentIds = (dom: Document): { commentId?: string; commentNo?: string } => ({
    commentId: findInScripts(dom, /\$\(document\)\.data\('comment_id',\s+'([^']+)'\);/),
    commentNo: findInScripts(dom, /\$\(document\)\.data\('comment_no',\s+'([^']+)'\);/)
});

const parseUser = (dom: Document): PostInfo["user"] => {
    const writer = dom.querySelector<HTMLElement>(".gallview_head > .gall_writer");
    if (!writer) return;

    const {nick, uid, ip} = writer.dataset;
    return {nick: nick || undefined, id: uid || undefined, ip: ip || undefined, image: writer.querySelector("img")?.src};
};

const strip = (value: string | undefined | null, ...prefixes: string[]): string | undefined => {
    if (!value) return;

    // 접두어를 뗀 뒤에 trim한다. 먼저 trim하면 '조회 1234'가 ' 1234'로 남는다.
    let result = value;
    for (const prefix of prefixes) result = result.replace(prefix, "");
    result = result.trim();

    return result || undefined;
};

/** 성인 인증이 필요한 글일 때 parsePostInfo가 던지는 Error의 message다. */
export const ADULT_ERROR = "adult";
/** 미니 갤러리 비밀글. 본문 대신 비밀번호 폼이 온다. */
export const SECRET_ERROR = "secret";

/** 성인 인증 안내 페이지인지. 본문이 없을 때만 부른다(본문의 주소 오인 방지). */
const isAdultPage = (html: string, dom: Document): boolean => html.includes("/error/adult") || dom.querySelector(".adult_certify") !== null;

const TXTCON_CHECKS = ["check_6", "check_7", "check_8"];

/** 글 페이지 스크립트의 `var _TS_CMT_ = {...};`. mode가 0이거나 없으면 디시도 Turnstile을 쓰지 않는다. */
const parseTurnstile = (dom: Document): TurnstileConfig | undefined => {
    for (const script of dom.scripts) {
        const json = script.textContent?.match(/var _TS_CMT_\s*=\s*(\{[^;]*});/)?.[1];
        if (!json) continue;
        try {
            const {mode, sitekey, wait, appearance, test} = JSON.parse(json);
            if (!Number(mode) || typeof sitekey !== "string") return;
            return {mode: Number(mode), sitekey, wait: parseInt(wait, 10) || 0, appearance: typeof appearance === "string" ? appearance : undefined, test: Boolean(test)};
        } catch {
            return;
        }
    }
};

const parseCommentForm = (dom: Document): CommentForm => ({
    fields: Array.from(dom.querySelectorAll<HTMLInputElement>("#focus_cmt > input"), (input): [string, string] => [input.name || input.id || "", input.value]),
    serviceCode: dom.querySelector<HTMLInputElement>("input[name=service_code]")?.value ?? "",
    dValue: dom.querySelector("#reply-setting-tmpl + script")?.textContent?.match(/_d\('([^']*)'\)/)?.[1],
    checks: Object.fromEntries(TXTCON_CHECKS.map((name) => [name, dom.querySelector<HTMLInputElement>(`#${name}`)?.value ?? ""])),
    gallNickName: dom.querySelector("#use_gall_nick") ? dom.querySelector<HTMLInputElement>("#focus_cmt input[name=gall_nick_name]")?.value ?? "" : undefined,
    turnstile: parseTurnstile(dom)
});

/** 본문 HTML → PostInfo. 비정상이면 undefined, 성인/비밀글이면 Error. */
export const parsePostInfo = (html: string): PostInfo | undefined => {
    const dom = new DOMParser().parseFromString(html, "text/html");

    if (!dom.querySelector(".gallview_head, .writing_view_box, .title_subject")) {
        // undefined면 fetchPost가 일반 오류(다시 시도 가능)로 던지므로 성인 인증은 따로 던진다.
        if (isAdultPage(html, dom)) throw new Error(ADULT_ERROR);
        return;
    }
    // 비밀번호 확인은 원문에서만 된다. 정화하면 입력칸이 빠져 누를 수 없는 확인 버튼만 남는다.
    if (dom.querySelector(".writing_view_box .mini_pwcheck")) throw new Error(SECRET_ERROR);

    restoreImageSources(dom);
    // 본문 위 짤방(갤러리 기본 이미지), 광고 자리는 글 내용이 아니다.
    for (const element of dom.querySelectorAll(".writing_view_box #zzbang_div, .writing_view_box #ad_nv_slot, .writing_view_box #tip_video, #spoiler_warning")) element.remove();
    numberImages(dom);

    // 제목 안 <script> 글자가 textContent에 섞이므로 먼저 지운다.
    const subject = dom.querySelector<HTMLElement>(".title_subject");
    for (const script of subject?.querySelectorAll("script") ?? []) script.remove();

    // 본문을 먼저 꺼내 뗀다. 본문의 같은 이름 입력칸, 스크립트가 먼저 걸리지 않게.
    const body = dom.querySelector<HTMLElement>(".writing_view_box");
    const contents = body?.innerHTML;
    const writeText = dom.querySelector(".write_div")?.textContent?.trim();
    body?.remove();

    const header = strip(dom.querySelector<HTMLElement>(".title_headtext")?.textContent?.replace(/^\[|]$/g, ""));
    const commentCountText = strip(dom.querySelector<HTMLElement>(".gall_comment")?.textContent?.trim().split(" ")[1]);
    // 작성 시각. title("2026-09-26 02:29:40")이 없으면 표시 글자("2026.09.26 02:29:40")를 쓴다.
    const date = dom.querySelector<HTMLElement>(".gallview_head .gall_date");

    const info: PostInfo = {
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
        contents,
        ...parseCommentIds(dom),
        // 0도 숫자로 남긴다. 댓글 요청을 건너뛸지 commentCount === 0으로 판단한다.
        commentCount: commentCountText && /^\d+$/.test(commentCountText) ? Number(commentCountText) : undefined,
        requireCaptcha: Boolean(dom.querySelector(".recommend_kapcode")),
        requireCommentCaptcha: Boolean(dom.querySelector<HTMLInputElement>(".cmt_write_box input[name=comment_code]")),
        v_cur_t: dom.querySelector<HTMLInputElement>("input[name=v_cur_t]")?.value,
        randomParam: (() => {
            const input = dom.querySelector<HTMLInputElement>("#adult_article + input");
            return input?.name ? {name: input.name, value: input.value} : undefined;
        })(),
        // 댓글, 추천에 쓸 값도 여기서 꺼내 둔다. 문서를 들고 있으면 캐시가 글마다 수천 노드짜리 문서를 붙잡는다.
        esno: dom.querySelector<HTMLInputElement>("#e_s_n_o")?.value,
        recommendCode: dom.querySelector<HTMLInputElement>("input[name=code_recommend]")?.value,
        writeText,
        commentForm: parseCommentForm(dom),
        commentDeleteFields: Array.from(dom.querySelectorAll<HTMLInputElement>("#_cmt_del_form_ > input"), (input): [string, string] => [input.name, input.value])
    };

    // 크롬은 <video>, <audio>가 든 문서를 붙잡는다. 값을 다 꺼냈으니 떼어 낸다.
    for (const media of dom.querySelectorAll("video, audio")) media.remove();
    return info;
};
