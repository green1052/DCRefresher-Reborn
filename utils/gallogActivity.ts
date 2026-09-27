import {LRUCache} from "lru-cache";
import {useEffect, useState} from "react";

import {fetchGallogActivity, type GallogActivity} from "@/core/gallog";
import {useUiStore} from "@/stores/ui";

/** uid별 갤로그 글/댓글 수 요청. 1시간 캐시하고, 실패한 항목은 지워 다음에 다시 받는다 */
const activityCache = new LRUCache<string, Promise<GallogActivity | undefined>>({max: 500, ttl: 3_600_000});

export type ActivityState = GallogActivity | undefined | "loading" | "error";

/** 갤로그 글/댓글 수. uid가 없으면(유동) 요청하지 않고 undefined다 */
export const useGallogActivity = (uid: string | undefined): ActivityState => {
    const [state, setState] = useState<ActivityState>(uid ? "loading" : undefined);

    useEffect(() => {
        // 버블처럼 계속 마운트된 곳은 여기서 비워야 유동 유저에 이전 고정닉의 글/댓글 수가 남지 않는다
        if (!uid) {
            setState(undefined);
            return;
        }

        // userinfo 글댓비 캐시에 있으면 그 값을 쓴다. 버블과 작성자 배지의 숫자가 같아지고 요청도 줄어든다
        const known = useUiStore.getState().ratios?.cache;
        if (known && Object.hasOwn(known, uid)) {
            setState(known[uid]);
            return;
        }

        let alive = true;
        setState("loading");

        if (!activityCache.has(uid)) activityCache.set(uid, fetchGallogActivity(uid).catch(() => undefined));
        void activityCache.get(uid)!.then((activity) => {
            if (!alive) return;
            if (!activity) activityCache.delete(uid);
            setState(activity ?? "error");
        });

        return () => {
            alive = false;
        };
    }, [uid]);

    return state;
};
