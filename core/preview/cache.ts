import {LRUCache} from "lru-cache";
import type {DcinsideComment, GalleryPreData, PostInfo} from "./types";

interface CacheEntry {
    post?: PostInfo;
    /** 삭제 댓글 보존용. 지금까지 받은 댓글 전부이며, 서버 목록에서 빠진 댓글은 삭제된 것으로 되살린다 */
    seen?: Record<string, DcinsideComment>;
}

// 게시글 캐시: 수명 1분, 최대 50개. 저장할 때마다 수명이 다시 1분으로 늘어난다.
// ttlAutopurge가 없으면 만료된 항목(본문 HTML 포함)이 50개에 밀려날 때까지 메모리에 남는다.
const entries = new LRUCache<string, CacheEntry>({max: 50, ttl: 60_000, ttlAutopurge: true});

const key = (preData: GalleryPreData): string => `${preData.gallery}:${preData.id}`;

export const getEntry = (preData: GalleryPreData): CacheEntry | undefined => entries.get(key(preData));

/** 기존 항목에 patch를 덮어써 저장한다 */
export const setEntry = (preData: GalleryPreData, patch: CacheEntry): void => {
    entries.set(key(preData), {...entries.get(key(preData)), ...patch});
};

/**
 * 삭제 댓글 보존: 지금까지 받은 댓글 중 이번 목록에 없는 것을 is_delete "1"로 되살린다.
 * 받은 댓글을 계속 모아 두므로 한 번 되살린 댓글은 캐시가 살아 있는 동안 계속 보인다.
 */
export const restoreArchive = (preData: GalleryPreData, list: DcinsideComment[]): DcinsideComment[] => {
    const seen = entries.get(key(preData))?.seen ?? {};
    const current = new Set(list.map((comment) => comment.no));

    const deleted: DcinsideComment[] = [];
    for (const comment of Object.values(seen)) {
        if (!current.has(comment.no)) deleted.push({...comment, is_delete: "1"});
    }

    const nextSeen = {...seen};
    const output = list.map((comment): DcinsideComment => {
        const before = seen[comment.no];

        // 답글 달린 부모 댓글은 지워져도 서버가 내용을 바꿔 삭제 표시로 남긴다.
        // 그대로 덮어쓰면 원문이 사라지므로 전에 받은 원문을 삭제 표시로 보여 준다.
        if (comment.is_delete !== "0" && before?.is_delete === "0") return {...before, is_delete: "1"};

        nextSeen[comment.no] = comment;
        return comment;
    });

    setEntry(preData, {seen: nextSeen});

    if (deleted.length === 0) return output;

    // 답글은 CommentList(Frame.tsx)가 c_no로 다시 묶으므로 번호(등록)순이면 충분하다.
    // 요청에 정렬 파라미터가 없어 서버 목록도 등록순이다.
    return [...output, ...deleted].sort((a, b) => Number(a.no) - Number(b.no));
};
