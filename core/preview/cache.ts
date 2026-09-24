import {LRUCache} from "lru-cache";
import type {GalleryPreData, IPostInfo} from "@/features/types";

export interface CacheEntry {
    date: number;
    post?: IPostInfo;
    comment?: CommentListResponse;
    deleted?: Record<string, DcinsideComment>;
}

export interface DcinsideComment {
    no: string;
    c_no: string;
    depth: number;
    user_id: string;
    name: string;
    password?: string;
   GallogIcon?: string;
    gallog_icon?: string;
    ip: string;
    memo: string;
    is_delete: "0" | "1";
    del_btn?: "Y" | "N";
    my_cmt?: "Y" | "N";
    date_time: string;
    reply_num?: number;
    [key: string]: unknown;
}

export interface CommentListResponse {
    list: DcinsideComment[];
    total_cnt: number;
    [key: string]: unknown;
}

const TTL = 60_000;
const MAX_SIZE = 50;

const entries = new LRUCache<string, CacheEntry>({max: MAX_SIZE, ttl: 60_000});

const key = (preData: GalleryPreData): string => `${preData.gallery}:${preData.id}`;

export const getEntry = (preData: GalleryPreData): CacheEntry | undefined => {
    const entry = entries.get(key(preData));
    if (!entry) return;
    if (Date.now() - entry.date > TTL) return;
    return entry;
};

/** 본문/댓글 병합 저장 (TTL 연장) */
export const setEntry = (preData: GalleryPreData, patch: Partial<CacheEntry>): CacheEntry => {
    const current = entries.get(key(preData)) ?? {date: Date.now()};
    const next: CacheEntry = {...current, ...patch, date: Date.now()};
    entries.set(key(preData), next);
    return next;
};

export const setDeleted = (preData: GalleryPreData, deleted: Record<string, DcinsideComment>): void => {
    const current = entries.get(key(preData)) ?? {date: Date.now()};
    entries.set(key(preData), {...current, deleted, date: Date.now()});
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

export const clearAll = (): void => entries.clear();
