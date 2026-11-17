import QuickLRU from "quick-lru";

import type {GallogActivity, RatioData} from "@/core/gallog";
import {trimRatios} from "@/core/gallog";
import {onMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule} from "@/core/module/background";
import {moduleDataStorage} from "@/core/storage/items";

import meta from "./meta";

// 갤로그 요청은 csrf 쿠키 때문에 콘텐츠 스크립트만 보낼 수 있다. 배경은 탭 사이의 조회권과 결과 공유만 맡는다.
const shared = new QuickLRU<string, GallogActivity>({maxSize: 500, maxAge: 3_600_000});

// 받고 있는 uid → 조회권을 준 시각. 결과가 안 오면(탭이 닫힘) 이 시간 뒤 다른 탭에 조회권을 준다.
const CLAIM_MS = 5_000;
const inflight = new Map<string, number>();

// 저장도 배경이 유일하게 한다. 탭마다 저장하면 열린 탭 수만큼 전체 객체가 모든 탭에 전달된다.
const ratioStorage = moduleDataStorage<RatioData>("userinfo", {});
const FLUSH_MS = 2_000;
let pending = new Map<string, GallogActivity>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

/** 받은 글댓비를 모아 저장소에 합친다. */
const flush = (): void => {
    if (pending.size === 0) return;
    const batch = pending;
    pending = new Map();
    const date = Date.now();
    void (async () => {
        const current = await ratioStorage.getValue();
        const received = Object.fromEntries([...batch].map(([uid, activity]) => [uid, {...activity, date}]));
        await ratioStorage.setValue({ratio: trimRatios({...current.ratio, ...received})});
    })();
};

/** 글댓비(userinfo): 같은 사람을 여러 탭이 동시에 받지 않게 조회권을 나눠 주고 결과를 1시간 공유한다. */
export default defineBackgroundModule(meta, {
    listen() {
        onMessage("refresher:gallogClaim", ({data: uid}) => {
            const cached = shared.get(uid);
            if (cached) return {mine: false, cached};
            const mine = Date.now() - (inflight.get(uid) ?? 0) >= CLAIM_MS;
            if (mine) inflight.set(uid, Date.now());
            return {mine};
        });
        onMessage("refresher:gallogResult", ({data: {uid, activity}}) => {
            if (activity) {
                shared.set(uid, activity);
                pending.set(uid, activity);
                if (flushTimer === undefined) {
                    flushTimer = setTimeout(() => {
                        flushTimer = undefined;
                        flush();
                    }, FLUSH_MS);
                }
            }
            inflight.delete(uid);
        });
    }
});
