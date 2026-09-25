import {LRUCache} from "lru-cache";
import type {CommentListResponse, DcinsideComment, GalleryPreData, PostInfo} from "./types";

interface CacheEntry {
    post?: PostInfo;
    comment?: CommentListResponse;
    deleted?: Record<string, DcinsideComment>;
}

// 게시글·댓글 캐시: 1분, 최대 50개. 저장할 때마다 수명이 다시 1분으로 늘어난다
const entries = new LRUCache<string, CacheEntry>({max: 50, ttl: 60_000});

const key = (preData: GalleryPreData): string => `${preData.gallery}:${preData.id}`;

export const getEntry = (preData: GalleryPreData): CacheEntry | undefined => entries.get(key(preData));

/** 본문/댓글/삭제 기록 병합 저장 */
export const setEntry = (preData: GalleryPreData, patch: CacheEntry): void => {
    entries.set(key(preData), {...entries.get(key(preData)), ...patch});
};

/** 아카이브(삭제글 보존): 이전 캐시 목록 대비 사라진 댓글에 is_delete=1 부여 */
export const restoreArchive = (preData: GalleryPreData, list: DcinsideComment[]): DcinsideComment[] => {
    const entry = entries.get(key(preData));
    const previous = entry?.comment?.list;

    if (!previous || previous.length === 0) return list;
    if (list.length === 0) return previous.map((comment) => ({...comment, is_delete: "1" as const}));

    const deleted: Record<string, DcinsideComment> = {};

    for (const previousComment of previous) {
        if (list.some((comment) => comment.no === previousComment.no)) continue;
        if (entry?.deleted?.[previousComment.no]) continue;

        deleted[previousComment.no] = {...previousComment, is_delete: "1"};
    }

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
