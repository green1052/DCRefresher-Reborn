import {isAnyBlocked, isBlocked} from "@/core/block";
import {sanitizeHtml} from "@/utils/sanitize";
import type {ModuleContext} from "@/core/module/types";

import {restoreArchive, setEntry} from "./cache";
import type {DcinsideComment, GalleryPreData} from "./types";

export interface ProcessedComment extends DcinsideComment {
    /** 음성댓글 — vr_player */
    voice?: { src: string };
}

const GALLOG_DCCON = /dcimg5\.dcinside\.com\/dccon\.php\?no=(\w*)/g;

/** 디시콘 2개짜리 댓글은 태그가 `…"img class="written_dccon`처럼 `><` 없이 붙어 온다 — 정화하면 두 번째가 속성으로 먹히므로 먼저 떼어 놓는다 */
const splitDccons = (memo: string): string => memo.replace(/"\s*(img|video) class="written_dccon/g, "\"><$1 class=\"written_dccon");

const cleanMemo = (memo: string): string =>
    sanitizeHtml(splitDccons(memo).replace(/data-dcconoverstatus="?\w+"?/g, "data-dcconoverstatus=\"true\""));

const extractVoice = (memo: string): { memo: string; voice?: { src: string } } | undefined => {
    if (!memo.includes("@^dc^@")) return;

    const [display = "", raw = ""] = memo.split("@^dc^@");
    const src = raw.includes("<iframe") ? (raw.match(/src="([^"]+)"/)?.[1] ?? "") : `https://vr.dcinside.com/${raw}`;

    // 음성댓글 호스트만 허용 — 임의 iframe 차단
    if (!src.startsWith("https://vr.dcinside.com/")) return;

    return {memo: display, voice: {src}};
};

/** 댓글 정리→사용자→차단→아카이브 처리 */
export const processComments = (
    raw: DcinsideComment[],
    preData: GalleryPreData,
    ctx: ModuleContext
): { list: ProcessedComment[]; threads: number; totalCnt: number } => {
    // 캐시된 원본을 보호하기 위해 복사본에서 가공
    const source = ctx.settings.archiveArticle === true ? restoreArchive(preData, raw) : raw;
    let list: ProcessedComment[] = source.map((comment) => ({...comment}));

    // 댓글돌이(COMMENT_BOY) 제거
    list = list.filter((comment) => String(comment.nicktype) !== "COMMENT_BOY");

    // 음성 분리 후 정제 — 음성 URL은 정제(재직렬화)하면 &가 &amp;로 바뀌므로 먼저 떼어낸다
    for (const comment of list) {
        const voice = extractVoice(String(comment.memo ?? ""));
        if (voice) comment.voice = voice.voice;
        comment.memo = cleanMemo(voice?.memo ?? String(comment.memo ?? ""));
    }

    // 차단: 내용 치환 + is_delete (행 제거 대신)
    for (const comment of list) {
        if (comment.is_delete === "1") continue;

        const plain = comment.memo.includes("<") ? comment.memo.replace(/<[^>]+>/g, " ") : comment.memo;
        // 디시콘 2개짜리 댓글은 두 번째도 검사한다
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

        if (!blocked) continue;

        comment.memo = "댓글 내용이 차단됐습니다.";
        comment.voice = undefined;
        comment.is_delete = "1";
    }

    // 아카이브 마킹 저장
    if (ctx.settings.archiveArticle === true) {
        const deleted: Record<string, DcinsideComment> = {};

        for (const comment of list) {
            if (comment.is_delete === "1") deleted[comment.no] = comment;
        }

        setEntry(preData, {deleted});
    }

    const threads = list.filter((comment) => comment.depth === 0).length;

    return {list, threads, totalCnt: list.length};
};

