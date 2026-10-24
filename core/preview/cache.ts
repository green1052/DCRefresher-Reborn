import QuickLRU from "quick-lru";

import {galleryKind} from "@/core/http/urls";

import type {CommentListResponse, DcinsideComment, GalleryPreData, PostInfo} from "./types";

interface CacheEntry {
    post?: PostInfo;
    /** post를 받은 시각(ms). 댓글 보존이 항목을 다시 저장하면 수명이 늘어나므로 본문이 얼마나 낡았는지는 이것으로 본다. */
    fetchedAt?: number;
    /** 삭제 댓글 보존용. 지금까지 받은 댓글 전부이며, 서버 목록에서 빠진 댓글은 삭제된 것으로 되살린다. */
    seen?: Record<string, DcinsideComment>;
    /** 마지막으로 그린 댓글 목록. 캐시로 다시 열면 새로 받는 동안 이것을 먼저 보인다. */
    comments?: CommentListResponse;
    /** comments를 디시에서 받은 시각(ms). 방금 받은 목록이면 다시 열어도 다시 받지 않는다. */
    commentsAt?: number;
}

// 게시글 캐시: 수명 1분. 저장할 때마다 수명이 다시 1분으로 늘어난다.
// quick-lru는 두 세대로 나눠 두어 maxSize의 두 배 가까이(49개) 남기고, 만료된 항목(본문 HTML 포함)도 밀려날 때까지 메모리에 둔다. 그래서 25로 둔다.
const MAX_AGE = 60_000;
const entries = new QuickLRU<string, CacheEntry>({maxSize: 25, maxAge: MAX_AGE});

/** seen(삭제 댓글 보존 기록)의 상한. 살아 있는 동안 새 댓글과 지워진 댓글이 계속 쌓이므로 오래된 것부터 버린다 (architecture.md의 캐시 상한 규칙). */
const SEEN_LIMIT = 2000;

// 만료된 항목은 꺼내거나 훑을 때에야 지워진다. 미리보기를 30개 열고 두면 본문 HTML·댓글 0.9MB가 그대로 남는다.
// 저장할 때마다 수명이 다시 시작되므로 마지막 저장의 수명이 끝난 뒤 한 번 훑는다. 훑기(이터레이터)가 만료된 항목을 지운다.
let sweep: ReturnType<typeof setTimeout> | undefined;
const scheduleSweep = (): void => {
    clearTimeout(sweep);
    sweep = setTimeout(() => Array.from(entries), MAX_AGE + 1_000);
};

/**
 * 글 하나를 가리키는 키. 번호는 갤러리마다 따로 매겨진다. 일반·마이너·미니·인물 갤러리는 id가 겹칠 수 있어 종류도 넣는다.
 * 일반 갤러리는 종류를 붙이지 않는다 ("id:번호").
 */
export const postKey = (preData: Pick<GalleryPreData, "gallery" | "id" | "link">): string => {
    const kind = galleryKind(preData.link);
    return `${kind === "normal" ? "" : `${kind}/`}${preData.gallery}:${preData.id}`;
};

export const getEntry = (preData: GalleryPreData): CacheEntry | undefined => entries.get(postKey(preData));

/** 기존 항목에 patch를 덮어써 저장한다. */
export const setEntry = (preData: GalleryPreData, patch: CacheEntry): void => {
    const key = postKey(preData);
    entries.set(key, {...entries.get(key), ...patch});
    scheduleSweep();
};

/**
 * 삭제 댓글 보존: 지금까지 받은 댓글 중 이번 목록에 없는 것을 is_delete "1"로 되살린다.
 * 받은 댓글을 계속 모아 두므로 한 번 되살린 댓글은 캐시가 살아 있는 동안 계속 보인다.
 * truncated: 10쪽(1000개)까지만 받았다. 새 댓글이 달리면 가장 오래된 댓글이 받는 범위 밖으로 밀리므로, 받은 것 중 가장 오래된 스레드와
 * 그보다 오래된 댓글은 목록에 없어도 삭제로 치지 않는다 (쪽은 스레드 중간에서도 잘린다).
 */
export const restoreArchive = (preData: GalleryPreData, list: DcinsideComment[], truncated = false): DcinsideComment[] => {
    const seen = entries.get(postKey(preData))?.seen ?? {};
    const current = new Set(list.map((comment) => comment.no));
    const thread = (comment: DcinsideComment): number => Number(comment.c_no) || Number(comment.no);
    // 빈 목록이면 min이 Infinity가 되므로 0으로 둔다 (전부 지워진 목록).
    const cutoff = truncated && list.length > 0 ? Math.min(...list.map(thread)) : 0;

    const deleted: DcinsideComment[] = [];
    for (const comment of Object.values(seen)) {
        if (!current.has(comment.no) && thread(comment) > cutoff) deleted.push({...comment, is_delete: "1"});
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
    // 받는 댓글은 1000개(10쪽)가 상한이지만 seen은 지워진 것까지 모아 자란다. 이번 목록에 없는(이미 지워진) 것을 먼저,
    // 그 안에서는 번호(등록순)가 오래된 것부터 버린다. 살아 있는 댓글은 지워질 때 원문을 되살려야 하므로 남긴다.
    const nos = Object.keys(nextSeen).sort((a, b) => Number(current.has(a)) - Number(current.has(b)) || Number(a) - Number(b));
    for (let i = 0; i < nos.length - SEEN_LIMIT; i++) delete nextSeen[nos[i]];

    setEntry(preData, {seen: nextSeen});

    if (deleted.length === 0) return output;

    // 답글은 CommentList(features/preview/ui/CommentList.tsx)가 c_no로 다시 묶으므로 번호(등록)순이면 충분하다.
    // 요청에 정렬 파라미터가 없어 서버 목록도 등록순이다.
    return [...output, ...deleted].sort((a, b) => Number(a.no) - Number(b.no));
};
