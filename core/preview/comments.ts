import {block} from "@/core/block";
import type {GalleryPreData} from "@/features/types";
import type {ModuleContext} from "@/core/module/types";

import {type DcinsideComment, restoreArchive, setDeleted} from "./cache";

export interface ProcessedComment extends DcinsideComment {
    /** 음성댓글 — vr_player */
    voice?: { src: string };
}

const GALLOG_DCCON = /dcimg5\.dcinside\.com\/dccon\.php\?no=(\w*)/;

const cleanMemo = (memo: string): string =>
    memo
        .replace(/data-dcconoverstatus="?\w+"?/g, "data-dcconoverstatus=\"true\"")
        .replace(/ onmousedown="[^"]*"/g, "")
        .replace(/ style="[^"]*"/g, "");

const extractVoice = (memo: string): { memo: string; voice?: { src: string } } | undefined => {
    if (!memo.includes("@^dc^@")) return;

    const [display = "", raw = ""] = memo.split("@^dc^@");
    const src = raw.includes("<iframe") ? (raw.match(/src="([^"]+)"/)?.[1] ?? "") : `https://vr.dcinside.com/${raw}`;

    return {memo: display, voice: {src}};
};

/** 댓글 정리→사용자→차단→아카이브 처리 */
export const processComments = (
    raw: DcinsideComment[],
    preData: GalleryPreData,
    ctx: ModuleContext
): { list: ProcessedComment[]; threads: number; totalCnt: number } => {
    // 아카이브(삭제글 보존)
    let list: ProcessedComment[] = ctx.settings.archiveArticle === true ? (restoreArchive(preData, raw) as ProcessedComment[]) : (raw as ProcessedComment[]);

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

        const blocked = block.checkAll(
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

        setDeleted(preData, deleted);
    }

    const threads = list.filter((comment) => comment.depth === 0).length;

    return {list, threads, totalCnt: list.length};
};

