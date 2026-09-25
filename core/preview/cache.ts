import {LRUCache} from "lru-cache";
import type {DcinsideComment, GalleryPreData, PostInfo} from "./types";

interface CacheEntry {
    post?: PostInfo;
    /** 보존(삭제글 보존)용 — 지금까지 받은 댓글 전부. 서버 목록에서 빠지면 삭제된 것으로 되살린다 */
    seen?: Record<string, DcinsideComment>;
}

// 게시글 캐시: 1분, 최대 50개. 저장할 때마다 수명이 다시 1분으로 늘어난다
// ttlAutopurge — 없으면 만료된 항목(글 문서 전체)이 50개에 밀려날 때까지 메모리에 남는다
const entries = new LRUCache<string, CacheEntry>({max: 50, ttl: 60_000, ttlAutopurge: true});

const key = (preData: GalleryPreData): string => `${preData.gallery}:${preData.id}`;

export const getEntry = (preData: GalleryPreData): CacheEntry | undefined => entries.get(key(preData));

/** 본문/삭제 기록 병합 저장 */
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

    const deleted: DcinsideComment[] = [];
    for (const comment of Object.values(seen)) {
        if (!current.has(comment.no)) deleted.push({...comment, is_delete: "1"});
    }

    const nextSeen = {...seen};
    const output = list.map((comment): DcinsideComment => {
        const before = seen[comment.no];

        // 답글 달린 부모처럼 서버가 삭제 표시(내용 대체)로 남긴 댓글 — 덮어쓰면 원문이 사라지므로 원문을 지키고 그것을 보여 준다.
        // 디시가 '1' 말고 다른 삭제 코드를 쓸 수도 있어 v5처럼 '0'이 아닌지로 본다
        if (comment.is_delete !== "0" && before?.is_delete === "0") return {...before, is_delete: "1"};

        nextSeen[comment.no] = comment;
        return comment;
    });

    setEntry(preData, {seen: nextSeen});

    if (deleted.length === 0) return output;

    // CommentList가 답글을 c_no로 다시 묶으므로 등록순만 맞추면 된다 — 요청에 정렬 파라미터가 없어 서버 목록도 등록순이다
    return [...output, ...deleted].sort((a, b) => Number(a.no) - Number(b.no));
};
