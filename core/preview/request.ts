import {ajax, formBody, http} from "@/core/http/client";
import {galleryKind, galleryPath, galltypeOf, urls} from "@/core/http/urls";
import {csrfBody} from "@/utils/cookie";
import {isRecord} from "@/utils/record";

import {parsePostInfo} from "./parser";
import type {BlockDay, BlockReason, CommentListResponse, DcinsideComment, DcinsideDccon, DcinsideDcconPackage, GalleryPreData, PostInfo} from "./types";

/** 디시 요청 본문. 모든 요청에 붙는 CSRF 토큰·갤러리 종류 뒤에 fields를 붙인다 (formBody 규칙) */
const dcBody = (link: string, fields: Parameters<typeof formBody>[0]): Promise<URLSearchParams> =>
    csrfBody({_GALLTYPE_: galltypeOf(link), ...fields});

export const viewUrl = (link: string, gallery: string, id: string): string => `${urls.base}${galleryPath(link)}board/view/?id=${gallery}&no=${id}`;

/** 게시글을 받아 PostInfo로 푼다. 삭제된 글은 디시가 404를 주고, 임시 차단은 HTTP 클라이언트가 BlockedError로 던진다. 그 밖에 글이 없는 페이지면 Error */
export const fetchPost = async (preData: GalleryPreData, signal: AbortSignal): Promise<PostInfo> => {
    const response = await http.get(viewUrl(preData.link, preData.gallery, preData.id), {signal}).text();

    const postInfo = parsePostInfo(response);
    if (!postInfo) throw new Error("게시글 페이지가 아닙니다.");

    return postInfo;
};

/** 댓글 목록. 한 쪽에 100개씩이라 여러 쪽을 받아 합친다 */
export const fetchComments = async (preData: GalleryPreData, postInfo: Pick<PostInfo, "commentId" | "commentNo" | "esno">, signal: AbortSignal): Promise<CommentListResponse> => {
    const body = await dcBody(preData.link, {
        id: preData.gallery,
        no: preData.id,
        cmt_id: postInfo.commentId ?? preData.gallery,
        cmt_no: postInfo.commentNo ?? preData.id,
        e_s_n_o: postInfo.esno ?? ""
    });

    // 1쪽이 실패하면(갱신 차단 등) 함께 보낸 어림 쪽 요청도 끊는다. 막힌 서버에 요청을 더 보내지 않는다
    const pageAbort = new AbortController();
    const pageSignal = AbortSignal.any([signal, pageAbort.signal]);
    const fetchPage = (page: number) => {
        const pageBody = new URLSearchParams(body);
        pageBody.set("comment_page", String(page));
        return ajax.post(urls.comments, {body: pageBody, signal: pageSignal}).json<{
            comments: DcinsideComment[] | null;
            total_cnt: number | string;
            pagination: string | null;
            allow_reply?: number | string | null;
        }>();
    };

    // 목록의 댓글 수로 쪽 수를 어림해 1쪽과 함께 받는다. 1쪽을 받은 뒤에 나머지를 요청하면 댓글이 많은 글은 그만큼(수백 ms) 늦게 뜬다.
    // 목록의 수는 삭제된 댓글을 빼고 세어 모자랄 수 있으므로, 1쪽의 쪽 나눔(viewComments(n, …))에서 마지막 쪽 번호를 읽어 남은 쪽을 마저 받는다.
    // 1쪽을 먼저 요청해야 동시 요청 수(요청 제한 모듈)에 막혀도 쪽 나눔을 먼저 받는다. 1쪽이 실패하면 어림한 쪽의 실패는 버린다.
    // 10쪽(1000개)까지만 받는다. 더 많은 글은 드물고, 자동 갱신 때마다 전부 다시 받기 때문이다.
    const guessed = Math.min(10, Math.max(1, Math.ceil(preData.commentCount / 100)));
    const firstPage = fetchPage(1);
    const early = Promise.all(Array.from({length: guessed - 1}, (_, index) => fetchPage(index + 2)));
    early.catch(() => {});

    const first = await firstPage.catch((e: unknown) => {
        pageAbort.abort();
        throw e;
    });
    const pages = Math.max(1, ...Array.from(first.pagination?.matchAll(/viewComments\((\d+)/g) ?? [], (match) => Number(match[1])));
    const rest = Promise.all(Array.from({length: Math.max(0, Math.min(10, pages) - guessed)}, (_, index) => fetchPage(guessed + index + 1)));
    const [earlyPages, restPages] = await Promise.all([early, rest]);

    // 1쪽이 가장 최근 댓글이고 뒤쪽일수록 오래된 댓글이다. 쪽 사이에 같은 댓글이 겹쳐 올 수 있어 번호로 하나만 남기고 번호(등록)순으로 맞춘다
    const byNo = new Map<string, DcinsideComment>();
    for (const response of [first, ...earlyPages, ...restPages]) {
        for (const comment of response.comments ?? []) byNo.set(comment.no, comment);
    }

    // 디시 comment.js처럼 0일 때만 막는다 (멤버만 댓글)
    return {list: [...byNo.values()].sort((a, b) => Number(a.no) - Number(b.no)), allowReply: String(first.allow_reply) !== "0", truncated: pages > 10};
};

/** 'result||message||detail' 텍스트 응답. 댓글 작성·삭제, 추천, JSON이 아닌 관리 응답이 이 모양이다 */
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

/** 디시가 준 안내 문구. 'false||nomember||메시지'면 문구는 세 번째 칸이다 */
export const resultMessage = ({message, detail}: SubmitResult): string | undefined => (message === "nomember" ? detail : message) || undefined;

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

    const body = await dcBody(preData.link, {
        id: preData.gallery,
        no: preData.id,
        mode,
        code_recommend: code ?? postInfo.recommendCode ?? "",
        link_id: preData.gallery,
        v_cur_t: postInfo.v_cur_t || undefined,
        ...(postInfo.randomParam && {[postInfo.randomParam.name]: postInfo.randomParam.value})
    });

    // 성공이면 'true||추천 수||고정닉 추천 수'
    const response = submitResult(await ajax.post(urls.vote, {body}).text());
    return response.result === "true"
        ? {success: true, counts: response.message, fixedCounts: response.detail}
        : {success: false, message: resultMessage(response)};
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
type ManageAction = "update_bump" | "delete_list" | "delete_comment" | "update_avoid_list" | "set_notice" | "set_recommend";

const manage = async (target: Pick<GalleryPreData, "link">, action: ManageAction, fields: Record<string, string>): Promise<ManageResult> => {
    const body = await dcBody(target.link, fields);

    const url = `${urls.base}ajax/${galleryKind(target.link) === "mini" ? "mini" : "minor"}_manager_board_ajax/${action}`;
    const text = (await ajax.post(url, {body}).text()).trim();

    try {
        const parsed: unknown = JSON.parse(text);
        if (isRecord(parsed)) {
            const {result, msg} = parsed;
            return {success: isSuccess(result), message: typeof msg === "string" && msg ? msg : undefined};
        }
    } catch {
        // 아래 텍스트 분기로
    }

    // JSON 객체가 아니면 "false||메시지" 같은 텍스트다. 맨 'true'·'false'도 JSON.parse가 원시값으로 읽어 여기로 온다
    const response = submitResult(text);
    return {success: isSuccess(response.result), message: resultMessage(response)};
};

/** 끌올 */
export const bump = (preData: GalleryPreData): Promise<ManageResult> => manage(preData, "update_bump", {id: preData.gallery, "nos[]": preData.id});

/** 게시글 삭제. manage 모듈의 Ctrl+클릭은 목록 행에서 얻은 갤러리·글 번호·주소만 있어 GalleryPreData 전체를 받지 않는다 */
export const deletePost = (target: Pick<GalleryPreData, "gallery" | "id" | "link">): Promise<ManageResult> =>
    manage(target, "delete_list", {id: target.gallery, "nos[]": target.id});

export interface BlockOptions {
    avoidHour: BlockDay;
    avoidReason: BlockReason;
    avoidReasonTxt: string;
    /** 선택한 글도 삭제 */
    delChk: boolean;
    /** 식별 코드 차단 시 IP 동시 차단 */
    userTypeChk: boolean;
}

/** 유저 차단 (관리 팝업/프리셋) */
export const blockUser = (preData: GalleryPreData, options: BlockOptions): Promise<ManageResult> => manage(preData, "update_avoid_list", {
    id: preData.gallery,
    "nos[]": preData.id,
    parent: "",
    avoid_hour: options.avoidHour,
    avoid_reason: options.avoidReason,
    avoid_reason_txt: options.avoidReasonTxt,
    del_chk: options.delChk ? "1" : "0",
    avoid_type_chk: options.userTypeChk ? "1" : "0"
});

/** 공지 등록/해제 */
export const setNotice = (preData: GalleryPreData, notice: boolean): Promise<ManageResult> =>
    manage(preData, "set_notice", {mode: notice ? "SET" : "REL", id: preData.gallery, no: preData.id});

/** 개념글 등록/해제 */
export const setRecommend = (preData: GalleryPreData, recommend: boolean): Promise<ManageResult> =>
    manage(preData, "set_recommend", {mode: recommend ? "SET" : "REL", id: preData.gallery, "nos[]": preData.id});

/** 이미지 캡챠 URL */
export const captchaImage = (preData: GalleryPreData, type: "comment" | "recommend"): string =>
    `${urls.base}kcaptcha/image_v3/?gall_id=${preData.gallery}&kcaptcha_type=${type}&time=${Date.now()}&_GALLTYPE_=${galltypeOf(preData.link)}`;

/** 관리자 댓글 삭제 */
export const adminDeleteComment = (preData: GalleryPreData, commentId: string): Promise<ManageResult> =>
    manage(preData, "delete_comment", {id: preData.gallery, pno: preData.id, "cmt_nos[]": commentId});

/** 유저 댓글 삭제 */
export const userDeleteComment = async (preData: GalleryPreData, commentId: string, password: string): Promise<ManageResult> => {
    const body = await dcBody(preData.link, {
        id: preData.gallery,
        no: preData.id,
        re_no: commentId,
        mode: "del",
        re_password: password || undefined,
        "g-recaptcha-response": ""
    });

    // 'true'만 성공으로 본다 (v5와 같음). 관리 요청과 달리 응답이 JSON이 아니다
    const response = submitResult(await ajax.post(urls.comment_remove, {body}).text());
    return {success: response.result === "true", message: resultMessage(response)};
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

            if (!form.dValue) return null;

            const decoded = atob(form.dValue.replace(/./g, (c) => b64[rKey.indexOf(c)] ?? ""));
            if (!decoded) return null;

            // 첫 자리 숫자를 5 당기거나 4 밀고, 쉼표로 나눈 수들을 글자로 바꿔 service_code 끝 10자리를 갈아 끼운다
            const fi = parseInt(decoded.slice(0, 1));
            const values = decoded.replace(/^./, String(fi > 5 ? fi - 5 : fi + 4)).split(",").map(Number);
            // 디시가 형식을 바꿔 숫자가 아니면 NaN이 "NaN"·"\0"으로 섞여 들어가 던지지 않고 틀린 코드가 된다
            if (Number.isNaN(fi) || values.some(Number.isNaN)) return null;
            const computed = values.map((value, index) => String.fromCharCode((2 * (value - index - 1)) / (13 - index - 1))).join("");

            return form.serviceCode.replace(/(.{10})$/, computed);
        } catch {
            return null;
        }
    })();
    // service_code를 못 만든 채 보내면 서버가 모호한 오류만 주므로 보내지 않고 알린다
    if (!code) return {result: "false", message: "댓글 폼을 읽지 못했습니다. 원문에서 작성해 주세요."};

    // 폼의 필드 중 같은 이름은 아래 값으로 바뀐다 (자리는 폼 순서 그대로)
    const params = formBody({
        t_vch2: "",
        t_vch2_chk: "",
        ...Object.fromEntries(form.fields.filter(([name]) => !["service_code", "gallery_no", "clickbutton"].includes(name))),
        service_code: code,
        c_gall_id: preData.gallery,
        c_gall_no: preData.id,
        id: preData.gallery,
        no: preData.id,
        c_no: commentNo || undefined,
        reply_no: replyNo || undefined,
        name: user.name,
        password: user.pw || undefined,
        use_gall_nick: "N",
        code: captcha || undefined,
        "g-recaptcha-response": "",
        "g-recaptcha-token": grecaptchaToken || undefined,
        bigdccon: bigDccon && "1",
        ...(typeof memo === "string"
            ? {memo}
            : {
                input_type: "comment",
                double_con_chk: memo.length > 1 && "1",
                package_idx: memo.map((dccon) => dccon.package_idx).join(","),
                detail_idx: memo.map((dccon) => dccon.detail_idx).join(",")
            })
    });

    return submitResult(await ajax.post(typeof memo === "string" ? urls.comments_submit : urls.dccon_comments_submit, {body: params}).text());
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

// 디시 txtcon_clusters 대신 브라우저 grapheme 분할을 쓴다. 국기·스킨톤·ZWJ 같은 흔한 글자는 결과가 같고, 분해형 한글 자모 등만 다르다
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

    const body = await dcBody(preData.link, {
        id: postInfo.commentId ?? preData.gallery,
        no: postInfo.commentNo ?? preData.id,
        txtcon_text: text,
        txtcon_bg: colors.bg,
        txtcon_color: colors.txt,
        c_no: commentNo || undefined,
        reply_no: replyNo || undefined,
        name: user.name || undefined,
        password: user.pw || undefined,
        code: captcha || undefined,
        ...form.checks,
        // 갤닉은 댓글(submitComment)처럼 쓰지 않는다
        ...(form.gallNickName !== undefined && {gall_nick_name: form.gallNickName, use_gall_nick: "N"}),
        "g-recaptcha-response": "",
        "g-recaptcha-token": grecaptchaToken || undefined
    });

    return submitResult(await ajax.post(urls.txtcon_submit, {body}).text());
};

/** 디시콘 하나의 코드로 패키지 정보를 가져온다 (디시 dc_common2.js의 '디시콘 보기') */
export const fetchDcconPackage = async (code: string, signal?: AbortSignal): Promise<DcinsideDcconPackage> => {
    const text = await ajax.post(urls.dccon.detail, {
        body: await csrfBody({code}),
        signal
    }).text();
    // 잘못된 코드면 JSON 대신 'error'가 온다
    if (text.trim() === "error") throw new Error("디시콘 정보가 잘못되었습니다.");

    const response = JSON.parse(text) as DcinsideDcconPackage;
    // 다른 모양(실패 응답 등)이면 정보 창을 그리다 오버레이 전체가 깨지므로 실패로 넘긴다 (DcconPopup의 fetchPage와 같다)
    if (!isRecord(response) || !isRecord(response.info) || !Array.isArray(response.detail) || !Array.isArray(response.tags)) {
        throw new Error("디시콘 정보가 아닙니다.");
    }
    return response;
};

/** 무료 디시콘 패키지를 내 디시콘에 추가한다 (디시 dc_common2.js의 '사용' 버튼) */
export const addDcconPackage = async (packageIdx: string | number): Promise<"ok" | "fail" | "not_login"> => {
    const text = (await ajax.post(urls.dccon.buy, {body: await csrfBody({package_idx: String(packageIdx)})}).text()).trim();
    return text === "ok" || text === "not_login" ? text : "fail";
};
