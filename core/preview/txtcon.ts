import {ajax} from "@/core/http/client";
import {urls} from "@/core/http/urls";

import {dcBody, type SubmitResult, submitResult} from "./response";
import type {GalleryPreData, PostInfo} from "./types";

export const TXTCON_BACKGROUNDS = ["3b4890", "b4b4e1", "f5e1f0", "d2f0e6", "ffffff", "333333"];
export const TXTCON_COLORS = ["ffffff", "333333"];

const TXTCON_MAX_LEN = 20;
const TXTCON_MAX_LINES = 4;
/** 한 줄 최대 글자 수. */
const TXTCON_MAX_LINE_LEN = 5;

// 컬러 이모지로 그려지는 BMP 문자. 글자 수에 1을 더 센다.
// 유니코드 집합 연산이 든 정규식은 만드는 데 비용이 있어 글자콘을 처음 셀 때 만든다. 모든 디시 페이지가 이 파일을 불러온다.
let bmpEmoji: RegExp | undefined;

/** 글자 수: UTF-16 코드 유닛 + BMP 컬러 이모지 가산 (줄바꿈 제외). */
const txtconLength = (text: string): number => {
    const plain = text.replaceAll("\n", "");

    return plain.length + (plain.match((bmpEmoji ??= /[\p{Emoji_Presentation}--[\u{10000}-\u{10FFFF}]]/gv))?.length ?? 0);
};

// 디시 txtcon_clusters 대신 브라우저 grapheme 분할을 쓴다. 국기·스킨톤·ZWJ 같은 흔한 글자는 결과가 같고, 분해형 한글 자모 등만 다르다.
let segmenter: Intl.Segmenter | undefined;
/** 글자콘의 '한 글자'(grapheme) 단위로 나눈다. 모든 디시 페이지에서 만들지 않도록 분할기는 처음 쓸 때 만든다. */
export const graphemes = (text: string): string[] => Array.from((segmenter ??= new Intl.Segmenter()).segment(text), ({segment}) => segment);

/** 직접 넣은 줄바꿈은 두고 각 줄을 5글자씩 나눈다. 입력 제한과 표시(features/preview/ui/Comment.tsx)가 같이 쓴다. */
export const wrapTxtcon = (text: string): string =>
    text
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => graphemes(line).map((char, i) => (i && i % TXTCON_MAX_LINE_LEN === 0 ? "\n" : "") + char).join(""))
        .join("\n");

/** 글자콘 입력값 정리 (txtcon.js 'wide' 문자 필터 + 20자·4줄·줄당 5자 제한). */
export const normalizeTxtcon = (value: string): string => {
    let text = value
        .replace(/\r\n?/g, "\n")
        // 이모지 구간 밖의 4바이트 문자와 아랍 표현형은 '+'로 바꾼다.
        .replace(/[[\u{10000}-\u{10FFFF}]--[\u{1F000}-\u{1FAFF}]]/gv, "+")
        .replace(/[\uFB50-\uFDFF\uFE70-\uFEFE]/g, "+")
        // 공백류는 일반 공백, 안 보이는 채움 문자는 제거.
        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
        .replace(/[\u2800\u115F\u1160\u3164\uFFA0\u034F\u17B4\u17B5]/g, "")
        .replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Zs}\p{M}\u{1F000}-\u{1FAFF}\u200D\uFE00-\uFE0F\n]/gu, "")
        .replace(/[{}]/g, "")
        // 결합 기호 연속은 2개까지.
        .replace(/\p{M}{3,}/gu, (marks) => Array.from(marks).slice(0, 2).join(""))
        .replace(/\.{4,}/g, "...")
        .split("\n")
        .slice(0, TXTCON_MAX_LINES)
        .join("\n");

    // 결과는 4줄×5글자와 줄바꿈 3개, 즉 23 grapheme을 넘을 수 없으니 미리 자른다.
    // 그래야 한 글자씩 빼며 전체를 다시 나누는 아래 루프가 긴 붙여넣기에서 O(n²)가 되지 않는다.
    text = graphemes(text).slice(0, (TXTCON_MAX_LINE_LEN + 1) * TXTCON_MAX_LINES).join("");

    // 5글자씩 나눈 줄 수가 넘치면 뒤에서부터 뺀다.
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

/** 글자콘 작성 (txtcon.js txtcon_submit). 첫 전송은 grecaptchaToken 없이 보낸다. */
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
        // 갤닉은 댓글(submitComment)처럼 쓰지 않는다.
        ...(form.gallNickName !== undefined && {gall_nick_name: form.gallNickName, use_gall_nick: "N"}),
        "g-recaptcha-response": "",
        "g-recaptcha-token": grecaptchaToken || undefined
    });

    return submitResult(await ajax.post(urls.txtcon_submit, {body}).text());
};
