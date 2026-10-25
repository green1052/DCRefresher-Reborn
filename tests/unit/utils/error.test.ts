import ky, {NetworkError, TimeoutError as KyTimeoutError} from "ky";
import {describe, expect, it} from "vitest";

import {friendlyMessage, isAbortError, isTimeoutError} from "@/utils/error";

/** ky가 직접 만든 HTTPError. fetch를 바꿔 요청은 나가지 않는다. */
const httpError = (status: number): Promise<unknown> =>
    ky.get("https://gall.dcinside.com/", {fetch: async () => new Response(null, {status}), retry: 0}).then(
        () => undefined,
        (e: unknown) => e
    );

describe("isTimeoutError", () => {
    it("limitedFetch가 끊은 DOMException과 ky의 TimeoutError를 둘 다 시간 초과로 본다", () => {
        expect(isTimeoutError(new DOMException("요청 시간 초과", "TimeoutError"))).toBe(true);
        expect(isTimeoutError(new KyTimeoutError(new Request("https://gall.dcinside.com/")))).toBe(true);
        expect(isTimeoutError(new DOMException("", "AbortError"))).toBe(false);
        expect(isTimeoutError(null)).toBe(false);
    });
});

describe("isAbortError", () => {
    it("이름으로만 본다", () => {
        expect(isAbortError(new DOMException("", "AbortError"))).toBe(true);
        // 파이어폭스 content.fetch의 오류는 다른 영역 객체라 instanceof Error가 틀릴 수 있다.
        expect(isAbortError({name: "AbortError"})).toBe(true);
        expect(isAbortError(new DOMException("", "TimeoutError"))).toBe(false);
        expect(isAbortError(new Error("AbortError"))).toBe(false);
        expect(isAbortError(null)).toBe(false);
        expect(isAbortError("AbortError")).toBe(false);
    });
});

describe("friendlyMessage", () => {
    it("HTTP 오류는 상태별로 안내한다", async () => {
        expect(friendlyMessage(await httpError(403))).toContain("막혔습니다");
        expect(friendlyMessage(await httpError(429))).toContain("막혔습니다");
        expect(friendlyMessage(await httpError(502))).toContain("서버가 불안정");
        expect(friendlyMessage(await httpError(404))).toBe("요청이 거절되었습니다. (HTTP 404)");
    });

    it("시간 제한 DOMException은 응답 없음이다", () => {
        // ky 2.2.0부터 ky의 isTimeoutError는 DOMException을 거짓으로 본다.
        expect(friendlyMessage(new DOMException("signal timed out", "TimeoutError"))).toContain("응답이 없습니다");
    });

    it("연결 실패는 인터넷 연결을 안내한다", () => {
        expect(friendlyMessage(new TypeError("Failed to fetch"))).toContain("연결하지 못했습니다");
        expect(friendlyMessage(new TypeError("NetworkError when attempting to fetch resource."))).toContain("연결하지 못했습니다");
        expect(friendlyMessage(new NetworkError(new Request("https://gall.dcinside.com/")))).toContain("연결하지 못했습니다");
    });

    it("JSON 오류·저장소 한도를 가린다", () => {
        expect(friendlyMessage(new SyntaxError("Unexpected token"))).toBe("JSON 형식이 올바르지 않습니다.");
        // 크롬의 실제 문구에는 quota도 들어 있어 쓰기 횟수 한도를 용량 한도보다 먼저 본다.
        expect(friendlyMessage(new Error("This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota."))).toContain("너무 자주");
        expect(friendlyMessage(new Error("QUOTA_BYTES quota exceeded"))).toBe("저장 공간이 부족합니다.");
    });

    it("한국어 안내는 그대로, 영어 원문은 숨긴다", () => {
        expect(friendlyMessage(new Error("글이 없습니다."))).toBe("글이 없습니다.");
        expect(friendlyMessage(new Error("Something went wrong"))).toBe("잠시 후 다시 시도해 주세요.");
    });
});
