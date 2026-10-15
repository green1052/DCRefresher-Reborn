import QuickLRU from "quick-lru";

import {duplicateOf, groupDuplicates, isAnyBlocked, isBlocked} from "@/core/block";
import type {ModuleSettings} from "@/core/module/types";
import {lowActivityOf, type Ratios} from "@/stores/ui";
import {htmlToText, sanitizeHtml} from "@/utils/sanitize";

import {restoreArchive} from "./cache";
import type {DcinsideComment, GalleryPreData} from "./types";

export interface ProcessedComment extends DcinsideComment {
    /** 음성댓글. iframe이면 src가 음성 파일이 아니라 플레이어 페이지라 <audio>로 틀 수 없다. */
    voice?: { src: string; iframe: boolean };
    /** 차단에 걸린 댓글을 가리는 방식 (차단 모듈 설정). blur는 흐리게, hide는 숨긴다. 깡계 댓글은 깡계 처리(userinfo)를 따른다. */
    blocked?: "blur" | "hide";
    /** 차단이 아니라 깡계라서 가렸다. 댓글 머리의 개수 요약이 따로 센다. */
    lowActivity?: true;
    /** 같은 댓글 묶음. 첫 댓글은 반복 수, 나머지는 0이며 접힌다. */
    duplicates?: number;
}

const GALLOG_DCCON = /dcimg5\.dcinside\.com\/dccon\.php\?no=(\w*)/g;

/**
 * 디시콘 2개짜리 댓글은 두 태그가 `…"img class="written_dccon`처럼 `><` 없이 붙어 온다.
 * 그대로 정화하면 두 번째 태그가 첫 태그의 속성으로 읽히므로 먼저 떼어 놓는다.
 */
const splitDccons = (memo: string): string => memo.replace(/"\s*(img|video) class="written_dccon/g, "\"><$1 class=\"written_dccon");

// 정화 결과는 입력에만 달려 있어 기억해 둔다. 자동 새로고침·차단 변경·가린 내용 보기마다 댓글 수백 개를 다시 정화하지 않는다.
const cleaned = new QuickLRU<string, string>({maxSize: 2000});
const sanitizeMemo = (memo: string): string => sanitizeHtml(splitDccons(memo).replace(/data-dcconoverstatus="?\w+"?/g, "data-dcconoverstatus=\"true\""));

// 정화된 댓글의 평문(차단 검사용)도 마찬가지로 입력에만 달려 있어 함께 기억한다.
const plainTexts = new QuickLRU<string, string>({maxSize: 2000});

/** 있으면 기억한 값, 없으면 compute로 만들어 기억한다. */
const remember = (cache: QuickLRU<string, string>, key: string, compute: (key: string) => string): string => {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const value = compute(key);
    cache.set(key, value);
    return value;
};

const plainTextOf = (html: string): string => remember(plainTexts, html, (text) => htmlToText(text).trim());

const extractVoice = (memo: string): { memo: string; voice?: ProcessedComment["voice"] } | undefined => {
    if (!memo.includes("@^dc^@")) return;

    // 구분자 앞은 음성 경로(또는 iframe 태그), 뒤는 글이다 (디시와 같은 해석).
    const [raw = "", display = ""] = memo.split("@^dc^@");
    const iframe = raw.includes("<iframe");
    const src = iframe ? (raw.match(/src="([^"]+)"/)?.[1] ?? "") : `https://vr.dcinside.com/${raw}`;

    // 음성댓글 호스트가 아니면 임의 iframe일 수 있어 음성은 버리고 글만 살린다.
    // memo를 그대로 두면 구분자와 iframe 태그가 글자로 보이므로 display만 돌려준다.
    if (!src.startsWith("https://vr.dcinside.com/")) return {memo: display};

    return {memo: display, voice: {src, iframe}};
};

/**
 * 받은 댓글 목록을 정리하고 삭제 댓글 보존(restoreArchive)을 적용한다.
 * 보존은 받은 기록을 쌓고 캐시 수명을 늘리므로 받을 때마다 한 번만 부른다.
 */
export const prepareComments = (raw: DcinsideComment[], preData: GalleryPreData, archive: boolean, truncated = false): DcinsideComment[] => {
    // 댓글돌이(COMMENT_BOY)는 보존 기록에 들어가지 않게 restoreArchive보다 먼저 뺀다.
    // 다른 삭제 코드('2' 등)나 del_yn "Y"로 온 댓글은 is_delete "1"로 맞춘다. 답글·삭제 버튼 숨김과 같은 댓글 접기 제외가 "1"로 판단한다.
    const filtered = raw
        .filter((comment) => comment.nicktype !== "COMMENT_BOY")
        .map((comment) => ({...comment, is_delete: comment.is_delete !== "0" || comment.del_yn === "Y" ? "1" : "0"}));

    return archive ? restoreArchive(preData, filtered, truncated) : filtered;
};

/**
 * 받은 두 댓글 목록이 같은지. 자동 새로고침이 같은 목록을 다시 받으면 다시 그리지 않으려고 쓴다.
 * 목록을 JSON 문자열로 만들어 비교하면 댓글이 1000개일 때 주기마다 1MB가 넘는 문자열을 만든다. 필드 값을 차례로 비교하고 다르면 바로 멈춘다.
 * 디시 댓글 필드는 문자열·숫자 같은 값이다. 객체 값이 오면 내용이 같아도 다르다고 보지만 다시 그릴 뿐이다.
 * T로 받아야 for...in의 키로 형 변환 없이 읽는다.
 */
export const sameComments = <T extends object>(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return false;
    for (const [index, comment] of a.entries()) {
        const other = b[index];
        if (other === undefined) return false;
        let fields = 0;
        for (const key in comment) {
            if (comment[key] !== other[key]) return false;
            fields++;
        }
        if (fields !== Object.keys(other).length) return false;
    }
    return true;
};

/** 차단하지 않은 깡계 댓글을 깡계 처리대로 가린다. 차단한 댓글은 차단 방식을 따른다. */
const markLowActivity = (list: ProcessedComment[], ratios: Ratios | null): ProcessedComment[] => {
    for (const comment of list) {
        const action = comment.blocked ? undefined : lowActivityOf(ratios, comment.user_id);
        if (action) Object.assign(comment, {blocked: action, lowActivity: true});
    }
    return list;
};

/**
 * 정화 → 차단 표시 → 깡계 가림 → 같은 댓글 묶기. 차단 목록이 바뀌면 같은 prepareComments 결과로 다시 부르므로
 * 입력(캐시된 원본)은 고치지 않고 복사본을 가공한다. block은 차단 모듈 설정, ratios는 userinfo의 글댓비 캐시와 깡계 설정이다.
 */
export const processComments = (
    source: DcinsideComment[], preData: GalleryPreData, block: ModuleSettings["block"] | undefined, ratios: Ratios | null = null
): ProcessedComment[] => {
    const list: ProcessedComment[] = source.map((comment) => ({...comment}));

    // 음성 URL은 정화(재직렬화)하면 &가 &amp;로 바뀌므로 정화 전에 떼어 낸다.
    for (const comment of list) {
        const memo = String(comment.memo ?? "");
        const voice = extractVoice(memo);
        // 늘 덮어쓴다. 디시 응답에도 voice 필드가 있어(보통 null) 그대로 두면 음성 댓글이 아닌데도 음성 댓글로 보인다(답글 막힘을 무시한다).
        comment.voice = voice?.voice;
        comment.memo = remember(cleaned, voice?.memo ?? memo, sanitizeMemo);
    }

    // 차단 모듈이 꺼져 있으면 block이 없고 깡계만 가린다.
    if (!block) return markLowActivity(list, ratios);
    // 페이지 쪽 검사처럼 앞뒤 공백을 뗀다. 디시콘만 있는 댓글이 " "로 남아 빈 글과 달라지지 않게.
    const texts = new Map(list.map((comment) => [comment, plainTextOf(comment.memo)]));

    for (const comment of list) {
        // 삭제 표시된 댓글도 검사한다. 보존으로 되살린 댓글은 원문을 담고 있어 건너뛰면 차단된 내용이 보인다.
        const plain = texts.get(comment);
        // 디시콘 2개짜리 댓글은 두 번째도 검사한다.
        const dcconNos = Array.from(comment.memo.matchAll(GALLOG_DCCON), (match) => match[1] ?? "");

        const blocked =
            isAnyBlocked(
                {
                    NICK: comment.name || null,
                    ID: comment.user_id || null,
                    IP: comment.ip || null,
                    COMMENT: plain || null
                },
                preData.gallery
            ) || dcconNos.some((no) => isBlocked("DCCON", no, preData.gallery));

        if (blocked) comment.blocked = block.blur ? "blur" : "hide";
    }

    if (block.replyRemove) {
        // 답글의 c_no는 스레드 첫 댓글 번호다.
        const blockedThreads = new Set(list.filter((comment) => comment.depth === 0 && comment.blocked).map((comment) => comment.no));
        for (const comment of list) if (comment.depth === 1 && blockedThreads.has(comment.c_no)) comment.blocked ??= block.blur ? "blur" : "hide";
    }

    // 답글 함께 가리기 뒤에 매긴다. 페이지처럼 깡계 댓글의 답글은 가리지 않는다.
    markLowActivity(list, ratios);

    const duplicate = duplicateOf(block);
    if (duplicate) {
        // 페이지처럼 가린 댓글(차단·깡계)은 세지 않는다.
        const candidates = list.filter((comment) => !comment.blocked && comment.is_delete !== "1");
        for (const [comment, repeats] of groupDuplicates(candidates, (comment) => texts.get(comment) ?? "", duplicate)) comment.duplicates = repeats;
    }

    return list;
};

