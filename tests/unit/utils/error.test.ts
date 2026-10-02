import {HTTPError, TimeoutError} from "ky";
import {describe, expect, it, vi} from "vitest";

import {friendlyMessage, messageOf, saveOrReload} from "@/utils/error";

const httpError = (status: number): HTTPError => {
    const request = new Request("https://gall.dcinside.com/x");
    return new HTTPError(new Response("", {status}), request, {} as never);
};

describe("friendlyMessage", () => {
    it.each([
        [httpError(429), "요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요."],
        [httpError(403), "요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요."],
        [httpError(502), "서버가 불안정합니다. 잠시 후 다시 시도해 주세요."],
        [httpError(404), "요청이 거절되었습니다. (HTTP 404)"],
        [new TypeError("Failed to fetch"), "서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요."],
        [new SyntaxError("Unexpected token"), "JSON 형식이 올바르지 않습니다."],
        [new Error("MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded"), "짧은 시간에 너무 자주 저장했습니다. 잠시 후 다시 시도해 주세요."],
        [new Error("QUOTA_BYTES quota exceeded"), "저장 공간이 부족합니다."],
        [new Error("백업이 없습니다."), "백업이 없습니다."],
        [new Error("Something internal"), "잠시 후 다시 시도해 주세요."]
    ])("%s → 안내 문구", (error, expected) => {
        expect(friendlyMessage(error)).toBe(expected);
    });

    it("시간 초과는 응답이 없다고 알린다", () => {
        const error = new TimeoutError(new Request("https://gall.dcinside.com/x"));
        expect(friendlyMessage(error)).toBe("응답이 없습니다. 잠시 후 다시 시도해 주세요.");
        // core/http/client가 시간 초과로 끊은 요청.
        expect(friendlyMessage(new DOMException("x", "TimeoutError"))).toBe("응답이 없습니다. 잠시 후 다시 시도해 주세요.");
    });
});

describe("messageOf", () => {
    it("Error가 아니어도 message가 있으면 쓰고, 없으면 문자열로 바꾼다", () => {
        expect(messageOf({message: "다른 영역의 오류"})).toBe("다른 영역의 오류");
        expect(messageOf("텍스트")).toBe("텍스트");
        expect(messageOf(null)).toBe("null");
    });
});

describe("saveOrReload", () => {
    it("저장이 실패하면 저장소 값으로 되돌리고 오류를 다시 던진다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const reload = vi.fn(async () => {});
        const error = new Error("quota");
        await expect(saveOrReload(Promise.reject(error), reload, "save")).rejects.toBe(error);
        expect(reload).toHaveBeenCalledOnce();
    });

    it("되돌리기도 실패해도 원래 오류를 던진다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const error = new Error("quota");
        await expect(saveOrReload(Promise.reject(error), async () => Promise.reject(new Error("reload")), "save")).rejects.toBe(error);
    });

    it("저장이 되면 되돌리지 않는다", async () => {
        const reload = vi.fn(async () => {});
        await saveOrReload(Promise.resolve(), reload, "save");
        expect(reload).not.toHaveBeenCalled();
    });
});
