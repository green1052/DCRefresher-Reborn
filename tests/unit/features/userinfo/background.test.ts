import {beforeEach, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import background from "@/features/userinfo/background";

const onMessage = vi.hoisted(() => vi.fn<(type: string, handler: (message: {data: never}) => unknown) => void>());
vi.mock("@/core/messaging/protocol", () => ({onMessage}));

type ClaimHandler = (message: {data: string}) => {mine: boolean; cached?: {article: number; comment: number}};
type ResultHandler = (message: {data: {uid: string; activity?: {article: number; comment: number}}}) => void;
const handler = <T>(type: string) => onMessage.mock.calls.find(([t]) => t === type)![1] as unknown as (message: {data: T}) => unknown;

const RATIO_KEY = "refresher:module:userinfo:data";
const stored = async (): Promise<{ ratio?: Record<string, {article: number; comment: number; date: number}> } | undefined> =>
    ((await fakeBrowser.storage.local.get(RATIO_KEY))[RATIO_KEY]) as { ratio?: Record<string, {article: number; comment: number; date: number}> } | undefined;

beforeEach(() => fakeBrowser.storage.local.clear());

it("조회권은 한 탭에만 주고, 결과는 공유 캐시로 돌려준다", async () => {
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

    // 저장 배치 타이머를 돌려 모듈 상태를 비운다 - 남기면 다음 테스트가 flush를 걸지 않는다.
    await vi.advanceTimersByTimeAsync(2_100);
    vi.useRealTimers();
});

it("받은 글댓비는 모아서 한 번 저장하고, 실패 결과는 저장하지 않는다", async () => {
    background.listen?.();
    const result = handler<{uid: string; activity?: {article: number; comment: number}}>("refresher:gallogResult") as ResultHandler;

    const set = vi.spyOn(fakeBrowser.storage.local, "set");
    result({data: {uid: "a", activity: {article: 1, comment: 2}}});
    result({data: {uid: "b", activity: {article: 3, comment: 4}}});
    // 실패(undefined)는 캐시, 저장 어디에도 남지 않는다.
    result({data: {uid: "c"}});
    expect(await stored()).toBeUndefined();

    // 모아서 한 번만 쓴다 (2초 뒤).
    await vi.waitFor(async () => expect(await stored()).toBeDefined(), {timeout: 4_000});
    expect(await stored()).toEqual({ratio: {
        a: {article: 1, comment: 2, date: expect.any(Number)},
        b: {article: 3, comment: 4, date: expect.any(Number)}
    }});
    expect(set.mock.calls.filter(([items]) => Object.hasOwn(items as object, RATIO_KEY))).toHaveLength(1);

    // 이어서 온 값은 저장돼 있던 값에 합친다.
    result({data: {uid: "d", activity: {article: 5, comment: 6}}});
    await vi.waitFor(async () => expect((await stored())?.ratio?.d).toBeDefined(), {timeout: 4_000});
    expect(Object.keys((await stored())?.ratio ?? {}).sort()).toEqual(["a", "b", "d"]);
});
