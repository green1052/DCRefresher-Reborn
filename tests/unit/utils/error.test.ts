import {HTTPError, NetworkError, type NormalizedOptions} from "ky";
import {describe, expect, it, vi} from "vitest";

import {friendlyMessage, messageOf, saveOrReload} from "@/utils/error";

const httpError = (status: number): HTTPError => {
    const request = new Request("https://gall.dcinside.com/board/lists?id=test");
    // HTTPError는 options에서 method만 읽는다.
    const options: Pick<NormalizedOptions, "method"> = {method: "GET"};
    return new HTTPError(new Response(null, {status}), request, options as NormalizedOptions);
};

describe("messageOf", () => {
    it("message 속성이 있는 값은 그 글자를 쓴다", () => {
        expect(messageOf(new Error("오류"))).toBe("오류");
        // 파이어폭스 페이지 영역의 DOMException처럼 instanceof Error가 아닌 것.
        expect(messageOf({message: "모양만"})).toBe("모양만");
    });

    it("그 밖에는 문자열로 바꾼다", () => {
        expect(messageOf("글자")).toBe("글자");
        expect(messageOf({message: 1})).toBe("[object Object]");
        expect(messageOf(null)).toBe("null");
    });
});

describe("saveOrReload", () => {
    it("저장이 되면 되돌리지 않는다", async () => {
        const reload = vi.fn(async () => {});
        await saveOrReload(Promise.resolve(), reload, "저장");
        expect(reload).not.toHaveBeenCalled();
    });

    it("저장이 실패하면 되돌리고 그 오류를 던진다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const reload = vi.fn(async () => {});
        await expect(saveOrReload(Promise.reject(new Error("쓰기 실패")), reload, "저장")).rejects.toThrow("쓰기 실패");
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("되돌리기가 실패해도 원래 오류를 던진다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const reload = vi.fn(async () => {
            throw new Error("읽기 실패");
        });
        await expect(saveOrReload(Promise.reject(new Error("쓰기 실패")), reload, "저장")).rejects.toThrow("쓰기 실패");
    });
});

describe("friendlyMessage", () => {
    it("HTTP 오류는 상태별로 안내한다", () => {
        expect(friendlyMessage(httpError(403))).toContain("막혔습니다");
        expect(friendlyMessage(httpError(429))).toContain("막혔습니다");
        expect(friendlyMessage(httpError(502))).toContain("서버가 불안정");
        expect(friendlyMessage(httpError(404))).toBe("요청이 거절되었습니다. (HTTP 404)");
    });

    it("시간 제한 DOMException은 응답 없음이다", () => {
        expect(friendlyMessage(new DOMException("signal timed out", "TimeoutError"))).toContain("응답이 없습니다");
    });

    it("연결 실패는 인터넷 연결을 안내한다", () => {
        expect(friendlyMessage(new TypeError("Failed to fetch"))).toContain("연결하지 못했습니다");
        expect(friendlyMessage(new TypeError("NetworkError when attempting to fetch resource."))).toContain("연결하지 못했습니다");
        expect(friendlyMessage(new NetworkError(new Request("https://gall.dcinside.com/")))).toContain("연결하지 못했습니다");
    });

    it("JSON 오류·저장소 한도를 가린다", () => {
        expect(friendlyMessage(new SyntaxError("Unexpected token"))).toBe("JSON 형식이 올바르지 않습니다.");
        expect(friendlyMessage(new Error("This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota."))).toContain("너무 자주");
        expect(friendlyMessage(new Error("QUOTA_BYTES quota exceeded"))).toBe("저장 공간이 부족합니다.");
    });

    it("한국어 안내는 그대로, 영어 원문은 숨긴다", () => {
        expect(friendlyMessage(new Error("글이 없습니다."))).toBe("글이 없습니다.");
        expect(friendlyMessage(new Error("Something went wrong"))).toBe("잠시 후 다시 시도해 주세요.");
    });
});
