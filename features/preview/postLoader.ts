import {blockMode, isBlocked} from "@/core/block";
import {isAbortError} from "@/core/http/client";
import {runningModuleSettings} from "@/core/module/registry";
import {getEntry, postKey, setEntry} from "@/core/preview/cache";
import {fetchPost} from "@/core/preview/request";
import type {GalleryPreData, PostInfo} from "@/core/preview/types";
import {sanitizeHtml} from "@/utils/sanitize";

import type {Ctx} from "./meta";

// 본문 차단은 차단 모듈 설정을 따르고, 원문은 남겨 '가린 내용 보기'로 볼 수 있게 한다.
export const textBlockOf = (preData: GalleryPreData, postInfo: PostInfo): PostInfo["textBlocked"] => {
    const block = runningModuleSettings("block");
    // 본문 HTML을 풀면 디시 스크립트 글자가 섞이므로 .write_div의 글자(writeText)로 검사한다.
    return block && postInfo.writeText !== undefined && isBlocked("TEXT", postInfo.writeText, preData.gallery) ? blockMode(block) : undefined;
};

/** 받은 지 1분 안의 캐시 본문과 그 나이(ms). 댓글 보존, 추천이 항목을 다시 저장해 수명을 늘리므로 받은 시각으로 본다. */
export const cachedPost = (preData: GalleryPreData): { post: PostInfo; age: number } | undefined => {
    const entry = getEntry(preData);
    const age = Date.now() - (entry?.fetchedAt ?? 0);
    return entry?.post && age < 60_000 ? {post: entry.post, age} : undefined;
};

/** 본문 하나를 받고 정화한다 - 미니, 열기, 미리 받기가 같이 쓰는 요청 슬롯. */
export const createPostLoader = (ctx: Ctx) => {
    // 우클릭 누름, 미니, 열기, 미리 받기가 같이 쓰는 본문 요청 하나. 다른 글을 받으면 앞 요청을 끊어 연타해도 쌓이지 않는다.
    let pending: { key: string; ctrl: AbortController; post: Promise<PostInfo> } | null = null;

    // 받은 글 객체마다 정화한 본문을 두어 다시 열 때 다시 정화하지 않는다.
    const sanitized = new WeakMap<PostInfo, string>();
    const sanitizedStripped = new WeakMap<PostInfo, string>();
    const processContents = async (preData: GalleryPreData, postInfo: PostInfo, stripMedia = false): Promise<PostInfo> => {
        const cache = stripMedia ? sanitizedStripped : sanitized;
        let contents = cache.get(postInfo);
        if (contents === undefined) {
            contents = sanitizeHtml(postInfo.contents ?? "", {stripMedia});
            cache.set(postInfo, contents);
        }
        return {...postInfo, contents, textBlocked: textBlockOf(preData, postInfo)};
    };

    const requestPost = (preData: GalleryPreData): Promise<PostInfo> => {
        const key = postKey(preData);
        if (pending?.key === key) return pending.post;

        pending?.ctrl.abort();
        const ctrl = new AbortController();
        const post = fetchPost(preData, ctrl.signal).then((result) => {
            setEntry(preData, {post: result, fetchedAt: Date.now()});
            return result;
        });
        const slot = {key, ctrl, post};
        pending = slot;

        // catch는 아무도 기다리지 않는 미리 받기가 실패해도 unhandled rejection이 나지 않게 붙인다.
        void post.catch(() => undefined).finally(() => {
            if (pending === slot) pending = null;
        });

        return post;
    };

    /** 캐시에 있으면 캐시(1분까지 낡음), 없으면 받는다. fresh는 방금 받았는지, archived는 보존본임. */
    const getPost = async (preData: GalleryPreData): Promise<{ post: PostInfo; fresh: boolean; archived?: true }> => {
        const cached = !ctx.settings.disableCache ? cachedPost(preData) : undefined;
        // 우클릭을 누르는 동안 미리 받은 본문은 캐시에서 꺼내도 방금 받은 것으로 친다. 기준 2초는 길게 누르기 판정 시간의 상한이다.
        if (cached) return {post: cached.post, fresh: cached.age < 2000};

        try {
            return {post: await requestPost(preData), fresh: true};
        } catch (e) {
            // 다른 글로 넘어가 끊은 요청은 보존본으로 대신하지 않는다.
            if (isAbortError(e)) throw e;
            // 삭제된 글 보존: 받지 못하면 캐시 비활성화여도 캐시에 남은 이전 본문을 보여 준다. 다시 저장해 수명을 늘린다.
            const archived = ctx.settings.archiveArticle ? getEntry(preData)?.post : undefined;
            if (!archived) throw e;
            console.error("Preview fetch failed, showing the archived post:", e);
            setEntry(preData, {post: archived});
            return {post: archived, fresh: false, archived: true};
        }
    };

    return {
        processContents,
        requestPost,
        getPost,
        hasPending: (): boolean => pending !== null,
        abortPending: (): void => {
            pending?.ctrl.abort();
            pending = null;
        }
    };
};
