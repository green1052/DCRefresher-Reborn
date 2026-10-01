import {afterEach, describe, expect, it, vi} from "vitest";

import {getGallogActivity} from "@/core/gallog";
import {ajax} from "@/core/http/client";

/** 응답을 차례로 주는 가짜 ajax.post. 받은 user_id를 모은다. */
const mockResponses = (...responses: (string | Error)[]) => {
    const asked: string[] = [];
    vi.spyOn(ajax, "post").mockImplementation(((_url: string, options?: { body?: URLSearchParams }) => {
        asked.push(options?.body?.get("user_id") ?? "");
        const response = responses.shift() ?? "";
        return {text: async () => (response instanceof Error ? Promise.reject(response) : response)};
    }) as never);
    return asked;
};

afterEach(() => vi.restoreAllMocks());

// 캐시가 모듈 전역이라 테스트마다 다른 아이디를 쓴다.
describe("getGallogActivity", () => {
    it("'글,댓글' 응답을 읽고, 같은 사람은 받는 중인 요청과 받은 값을 같이 쓴다", async () => {
        const asked = mockResponses("12,34");
        const [first, second] = await Promise.all([getGallogActivity("a1"), getGallogActivity("a1")]);
        expect(first).toEqual({article: 12, comment: 34});
        expect(second).toBe(first);
        expect(await getGallogActivity("a1")).toBe(first);
        expect(asked).toEqual(["a1"]);
    });

    it.each([
        ["형식이 다른 응답", "<html>"],
        ["빈 응답", ""],
        ["요청 실패", new Error("network")]
    ])("%s은 undefined이고 캐시에 남기지 않아 다음에 다시 묻는다", async (_name, response) => {
        const id = `b-${_name}`;
        const asked = mockResponses(response, "1,2");
        expect(await getGallogActivity(id)).toBeUndefined();
        expect(await getGallogActivity(id)).toEqual({article: 1, comment: 2});
        expect(asked).toEqual([id, id]);
    });
});
