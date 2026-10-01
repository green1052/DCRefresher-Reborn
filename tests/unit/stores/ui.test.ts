import {afterEach, describe, expect, it, vi} from "vitest";

import {DEFAULT_BADGE_VIEW, isFresh, isLowActivity, showsUid} from "@/stores/ui";

const ICON = "https://nstatic.dcinside.com/dc/w/images/";

describe("showsUid", () => {
    it("고정닉·반고정닉은 각 설정을 따르고, 닉콘이 없거나 모르는 닉콘이면 늘 보인다", () => {
        const view = {...DEFAULT_BADGE_VIEW, fixedUid: false, halfFixedUid: true};
        expect(showsUid(view, `${ICON}fix_managernik.gif`)).toBe(false);
        expect(showsUid(view, `${ICON}managernik.gif`)).toBe(true);
        expect(showsUid({...view, halfFixedUid: false}, `${ICON}managernik.gif`)).toBe(false);
        expect(showsUid(view)).toBe(true);
        expect(showsUid(view, `${ICON}unknown.gif`)).toBe(true);
    });
});

describe("isLowActivity", () => {
    it("글댓합이 기준 이하일 때만 깡계다. 기준 0은 끈 것이다", () => {
        expect(isLowActivity({article: 3, comment: 7}, 10)).toBe(true);
        expect(isLowActivity({article: 3, comment: 8}, 10)).toBe(false);
        expect(isLowActivity({article: 0, comment: 0}, 0)).toBe(false);
    });
});

describe("isFresh", () => {
    afterEach(() => vi.useRealTimers());

    it("1시간 안에 받은 값만 새 값이다", () => {
        vi.useFakeTimers({now: 10_000_000});
        expect(isFresh({date: 10_000_000 - 3600_000})).toBe(true);
        expect(isFresh({date: 10_000_000 - 3600_001})).toBe(false);
        expect(isFresh(undefined)).toBe(false);
    });
});
