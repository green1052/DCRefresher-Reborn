import {useEffect, useState} from "react";

import {fetchGallogActivity, type GallogActivity} from "@/core/gallog";

/** 글/댓글 수 — 갤로그에서 받는다 (세션 동안 캐시, 실패하면 다음에 다시) */
const activityCache = new Map<string, Promise<GallogActivity | undefined>>();

export type ActivityState = GallogActivity | undefined | "loading" | "error";

/** uid가 없으면 받지 않는다 */
export const useGallogActivity = (uid: string | undefined): ActivityState => {
    const [state, setState] = useState<ActivityState>(uid ? "loading" : undefined);

    useEffect(() => {
        // 계속 마운트된 곳(버블)은 비우지 않으면 유동 유저에 이전 고정닉의 글/댓글 수가 남는다
        if (!uid) {
            setState(undefined);
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
