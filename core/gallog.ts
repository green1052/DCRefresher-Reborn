import QuickLRU from "quick-lru";

import {ajax} from "@/core/http/client";
import {csrfBody} from "@/core/http/cookie";
import {sendMessage} from "@/core/messaging/protocol";

const GALLOG_API = "https://gall.dcinside.com/api/gallog_user_layer/gallog_content_reple";

export interface GallogActivity {
    article: number;
    comment: number;
}

/** 글댓비 캐시(userinfo)의 한 사람 값. date는 받은 시각이다. */
export interface RatioInfo extends GallogActivity {
    date: number;
}

/** 글댓비 저장소 모양. */
export interface RatioData {
    ratio?: Record<string, RatioInfo>;
}

/** 글댓비 저장 상한. 최근에 받은 사람부터 이만큼만 남긴다. */
const MAX_RATIOS = 500;

export const trimRatios = (all: Record<string, RatioInfo>): Record<string, RatioInfo> =>
    Object.fromEntries(Object.entries(all).sort(([, a], [, b]) => b.date - a.date).slice(0, MAX_RATIOS));

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

type ActivityListener = (uid: string, activity: GallogActivity) => void;
const listeners = new Set<ActivityListener>();

/** 새로 받은 값을 이 탭에 알린다. 기다리던 쪽보다 먼저 불리고, 듣는 쪽이 던져도 무시한다. */
const deliver = (uid: string, activity: GallogActivity): void => {
    for (const listener of listeners) {
        try {
            listener(uid, activity);
        } catch (e) {
            console.error(e);
        }
    }
};

/**
 * 갤로그에서 새로 받은 글/댓글 수를 알린다 (캐시에서 꺼낸 값은 알리지 않는다). 글댓비(userinfo)가 미리보기, 버블이 받은 값도 저장한다.
 * 해제 함수를 돌려준다.
 */
export const onGallogActivity = (listener: ActivityListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** 실패(undefined)는 캐시에 남지 않게 지운다. 그사이 같은 uid가 새 요청으로 바뀌었으면 그것은 건드리지 않는다. */
const remember = (uid: string, request: Promise<GallogActivity | undefined>): Promise<GallogActivity | undefined> => {
    activityCache.set(uid, request);
    void request.then((activity) => {
        if (!activity && activityCache.get(uid) === request) activityCache.delete(uid);
    });
    return request;
};

/** 배경의 탭 공유 캐시와 조회권. 통신이 안 되면 이 탭이 받는다. */
const sharedActivity = async (uid: string): Promise<{mine: boolean; cached?: GallogActivity}> => {
    try {
        return await sendMessage("refresher:gallogClaim", uid);
    } catch {
        return {mine: true};
    }
};

/** 받아 이 탭에 알리고 배경 공유 캐시에도 넣는다. */
const fetchAndShare = async (uid: string): Promise<GallogActivity | undefined> => {
    const activity = await fetchGallogActivity(uid).catch(() => undefined);
    void sendMessage("refresher:gallogResult", {uid, activity}).catch(() => {});
    if (activity) deliver(uid, activity);
    return activity;
};

/**
 * 캐시를 거친 갤로그 글/댓글 수. 실패하면 undefined다.
 * 유저 버블, 미리보기(useGallogActivity)와 글댓비(userinfo)가 같이 써서 같은 사람을 두 번 묻지 않는다.
 * 다른 탭이 이미 받아 둔 값이면 배경 공유 캐시로 바로 주고, 아니면 이 탭이 받아 나눠준다.
 */
export const getGallogActivity = (uid: string): Promise<GallogActivity | undefined> => {
    const known = activityCache.get(uid);
    if (known) return known;
    return remember(uid, (async () => {
        const {cached} = await sharedActivity(uid);
        if (cached) {
            deliver(uid, cached);
            return cached;
        }
        return fetchAndShare(uid);
    })());
};

/**
 * 자동 조회(새 글 폴링)용. 다른 탭이 받는 중이면 요청하지 않고 null - 다음 주기에 공유 캐시로 받는다.
 */
export const getGallogActivityUnlessBusy = (uid: string): Promise<GallogActivity | null | undefined> => {
    const known = activityCache.get(uid);
    if (known) return known;
    return (async () => {
        const {mine, cached} = await sharedActivity(uid);
        if (cached) {
            // 알림을 받는 쪽이 같은 uid를 다시 묻는 사이 아직 캐시가 비어 있으니 먼저 기억시킨다.
            const request = remember(uid, Promise.resolve(cached));
            deliver(uid, cached);
            return request;
        }
        if (!mine) return null;
        return remember(uid, fetchAndShare(uid));
    })();
};
