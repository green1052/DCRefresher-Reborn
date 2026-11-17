import {expect, it, vi} from "vitest";

import background from "@/features/userinfo/background";

const onMessage = vi.hoisted(() => vi.fn<(type: string, handler: (message: {data: never}) => unknown) => void>());
vi.mock("@/core/messaging/protocol", () => ({onMessage}));

type ClaimHandler = (message: {data: string}) => {mine: boolean; cached?: {article: number; comment: number}};
type ResultHandler = (message: {data: {uid: string; activity?: {article: number; comment: number}}}) => void;
const handler = <T>(type: string) => onMessage.mock.calls.find(([t]) => t === type)![1] as unknown as (message: {data: T}) => unknown;

it("조회권은 한 탭에만 주고, 결과는 공유 캐시로 돌려준다", () => {
    background.listen?.();
    const claim = handler<string>("refresher:gallogClaim") as ClaimHandler;
    const result = handler<{uid: string; activity?: {article: number; comment: number}}>("refresher:gallogResult") as ResultHandler;

    const now = Date.now();
    vi.useFakeTimers().setSystemTime(now);

    expect(claim({data: "a"})).toEqual({mine: true});
    expect(claim({data: "a"})).toEqual({mine: false});

    // 결과가 안 오면(탭이 닫힘) 시한 뒤 다른 탭에 조회권을 준다.
    vi.setSystemTime(now + 6_000);
    expect(claim({data: "a"})).toEqual({mine: true});

    result({data: {uid: "a", activity: {article: 1, comment: 2}}});
    expect(claim({data: "a"})).toEqual({mine: false, cached: {article: 1, comment: 2}});

    // 실패 결과는 캐시를 지우지 않고 조회권만 푼다 - 성공한 다른 uid로 확인한다.
    expect(claim({data: "b"})).toEqual({mine: true});
    result({data: {uid: "b"}});
    expect(claim({data: "b"})).toEqual({mine: true});

    vi.useRealTimers();
});
