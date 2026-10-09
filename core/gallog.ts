import QuickLRU from "quick-lru";

import {ajax} from "@/core/http/client";
import {csrfBody} from "@/core/http/cookie";

const GALLOG_API = "https://gall.dcinside.com/api/gallog_user_layer/gallog_content_reple";

export interface GallogActivity {
    article: number;
    comment: number;
}

/** 글댓비 캐시(userinfo)의 한 사람 값. date는 받은 시각이다. */
export interface RatioInfo extends GallogActivity {
    date: number;
}

/** 갤로그의 글/댓글 수 ("글,댓글" 텍스트 응답). */
const fetchGallogActivity = async (uid: string): Promise<GallogActivity | undefined> => {
    const text = await ajax.post(GALLOG_API, {
        body: await csrfBody({user_id: uid})
    }).text();

    const [article = NaN, comment = NaN] = text.split(",").map(Number);
    if (!Number.isFinite(article) || !Number.isFinite(comment)) return undefined;

    return {article, comment};
};

/** uid별 요청. 1시간 캐시하고, 받는 중인 요청은 같이 기다린다. */
const activityCache = new QuickLRU<string, Promise<GallogActivity | undefined>>({maxSize: 500, maxAge: 3_600_000});

/**
 * 캐시를 거친 갤로그 글/댓글 수. 실패하면 undefined다.
 * 유저 버블·미리보기(useGallogActivity)와 글댓비(userinfo)가 같이 써서 같은 사람을 두 번 묻지 않는다.
 */
export const getGallogActivity = (uid: string): Promise<GallogActivity | undefined> => {
    let request = activityCache.get(uid);
    if (!request) {
        // 실패한 항목은 받은 자리에서 지운다. 기다리던 쪽이 먼저 사라져도 실패가 1시간 캐시에 남지 않는다.
        // 그사이 이 항목이 밀려나 새 요청이 들어왔으면 그것은 지우지 않는다.
        const pending: Promise<GallogActivity | undefined> = fetchGallogActivity(uid).catch(() => undefined).then((activity) => {
            if (!activity && activityCache.get(uid) === pending) activityCache.delete(uid);
            return activity;
        });
        request = pending;
        activityCache.set(uid, request);
    }
    return request;
};
