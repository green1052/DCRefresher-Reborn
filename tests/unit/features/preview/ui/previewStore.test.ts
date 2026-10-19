import {describe, expect, it, vi} from "vitest";

import {parseDate} from "@/features/preview/ui/previewStore";

// 기댓값은 UTC로 적는다. 기계 시간대(로컬 KST, CI UTC)와 상관없이 같아야 한다.
describe("parseDate", () => {
    it("연도가 있는 시각을 한국 시간으로 읽는다", () => {
        expect(parseDate("2026.09.26 02:29:40").toISOString()).toBe("2026-09-25T17:29:40.000Z");
    });

    it("빠진 연도는 한국 날짜로 채운다", () => {
        // UTC로는 아직 2026년이지만 한국은 2027년 1월 1일 0시 30분이다.
        vi.useFakeTimers({now: new Date("2026-12-31T15:30:00Z")});
        expect(parseDate("01.01 00:10:00").toISOString()).toBe("2026-12-31T15:10:00.000Z");
    });
});
