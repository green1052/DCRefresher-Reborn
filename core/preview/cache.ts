import {LRUCache} from "lru-cache";
import type {CommentListResponse, DcinsideComment, GalleryPreData, PostInfo} from "./types";

interface CacheEntry {
    post?: PostInfo;
    comment?: CommentListResponse;
    /** 보존(삭제글 보존)용 — 지금까지 받은 댓글 전부. 서버 목록에서 빠지면 삭제된 것으로 되살린다 */
    seen?: Record<string, DcinsideComment>;
}

// 게시글·댓글 캐시: 1분, 최대 50개. 저장할 때마다 수명이 다시 1분으로 늘어난다
const entries = new LRUCache<string, CacheEntry>({max: 50, ttl: 60_000});

const key = (preData: GalleryPreData): string => `${preData.gallery}:${preData.id}`;

export const getEntry = (preData: GalleryPreData): CacheEntry | undefined => entries.get(key(preData));

/** 본문/댓글/삭제 기록 병합 저장 */
export const setEntry = (preData: GalleryPreData, patch: CacheEntry): void => {
    entries.set(key(preData), {...entries.get(key(preData)), ...patch});
};

/**
 * 아카이브(삭제글 보존): 지금까지 받은 댓글 중 이번 목록에 없는 것을 is_delete=1로 되살린다.
 * 받은 댓글을 계속 모아 두므로 한 번 되살린 댓글은 캐시가 살아 있는 동안 계속 보인다.
 */
export const restoreArchive = (preData: GalleryPreData, list: DcinsideComment[]): DcinsideComment[] => {
    const seen = entries.get(key(preData))?.seen ?? {};
    const current = new Set(list.map((comment) => comment.no));

    const deleted: Record<string, DcinsideComment> = {};
    for (const comment of Object.values(seen)) {
        if (!current.has(comment.no)) deleted[comment.no] = {...comment, is_delete: "1"};
    }

    setEntry(preData, {seen: {...seen, ...Object.fromEntries(list.map((comment) => [comment.no, comment]))}});

    if (Object.keys(deleted).length === 0) return list;

    const output: DcinsideComment[] = [];

    for (const comment of list) {
        output.push(comment);

        // depth1은 부모 바로 뒤에 삽입
        const parents = Object.values(deleted).filter((deletedComment) => deletedComment.c_no === comment.no);
        for (const parent of parents) output.push(parent);
    }

    // 부모가 모두 사라진 고아는 그대로 뒤에 추가
    for (const deletedComment of Object.values(deleted)) {
        if (!output.some((comment) => comment.no === deletedComment.no)) output.push(deletedComment);
    }

    return output;
};
