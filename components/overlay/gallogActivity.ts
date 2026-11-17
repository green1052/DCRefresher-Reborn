import {useEffect, useState} from "react";

import {type GallogActivity, getGallogActivity} from "@/core/gallog";
import {isFresh, useUiStore} from "@/stores/ui";

export type ActivityState = GallogActivity | undefined | "loading" | "error";

// 1시간 안에 받은 userinfo 글댓비 캐시를 쓴다 - 요청이 줄고 '불러오는 중' 깜박임도 없다.
const cachedActivity = (uid: string): GallogActivity | undefined => {
    const known = useUiStore.getState().ratios?.cache;
    const cached = known && Object.hasOwn(known, uid) ? known[uid] : undefined;
    return isFresh(cached) ? cached : undefined;
};

export const useGallogActivity = (uid: string | undefined): ActivityState => {
    const [state, setState] = useState<ActivityState>(() => (uid ? (cachedActivity(uid) ?? "loading") : undefined));

    useEffect(() => {
        // 버블처럼 계속 마운트된 곳은 여기서 비워야 유동 유저에 이전 고정닉의 글/댓글 수가 남지 않는다.
        if (!uid) {
            setState(undefined);
            return;
        }

        const cached = cachedActivity(uid);
        if (cached) {
            setState(cached);
            return;
        }

        let alive = true;
        setState("loading");

        void getGallogActivity(uid).then((activity) => {
            if (alive) setState(activity ?? "error");
        });

        return () => {
            alive = false;
        };
    }, [uid]);

    return state;
};
