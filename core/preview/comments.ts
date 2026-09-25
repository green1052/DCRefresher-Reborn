import {isAnyBlocked} from "@/core/block";
import type {ModuleContext} from "@/core/module/types";

import {restoreArchive, setEntry} from "./cache";
import type {DcinsideComment, GalleryPreData} from "./types";

export interface ProcessedComment extends DcinsideComment {
    /** 음성댓글 — vr_player */
    voice?: { src: string };
}

const GALLOG_DCCON = /dcimg5\.dcinside\.com\/dccon\.php\?no=(\w*)/;

const cleanMemo = (memo: string): string =>
    memo
        .replace(/data-dcconoverstatus="?\w+"?/g, "data-dcconoverstatus=\"true\"")
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/g, "")
        .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/g, "");

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

    // 속성 정리
    for (const comment of list) {
        comment.memo = cleanMemo(String(comment.memo ?? ""));
    }

    // 차단: 내용 치환 + is_delete (행 제거 대신)
    for (const comment of list) {
        if (comment.is_delete === "1") continue;

        const plain = comment.memo.includes("<") ? comment.memo.replace(/<[^>]+>/g, " ") : comment.memo;
        const dcconNo = comment.memo.match(GALLOG_DCCON)?.[1];

        const blocked = isAnyBlocked(
            {
                NICK: comment.name || null,
                ID: comment.user_id || null,
                IP: comment.ip || null,
                DCCON: dcconNo || null,
                COMMENT: plain || null
            },
            preData.gallery
        );

        if (!blocked) continue;

        comment.memo = "댓글 내용이 차단됐습니다.";
        comment.is_delete = "1";
    }

    // 음성 분리
    for (const comment of list) {
        const voice = extractVoice(comment.memo);
        if (voice) {
            comment.memo = voice.memo;
            comment.voice = voice.voice;
        }
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

