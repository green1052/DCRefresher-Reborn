import {describe, expect, it, vi} from "vitest";

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
    ])("%s은 undefined이고 캐시에 남기지 않아 다음에 다시 묻는다", async (name, response) => {
        const id = `b-${name}`;
        const asked = mockResponses(response, "1,2");
        expect(await getGallogActivity(id)).toBeUndefined();
        expect(await getGallogActivity(id)).toEqual({article: 1, comment: 2});
        expect(asked).toEqual([id, id]);
    });

    it("늦게 실패한 요청은 그사이 새로 들어온 요청의 캐시를 지우지 않는다", async () => {
        vi.useFakeTimers({toFake: ["Date"]});
        let failFirst: (error: Error) => void = () => {};
        const asked: string[] = [];
        vi.spyOn(ajax, "post").mockImplementation((() => {
            asked.push("c1");
            return asked.length === 1
                ? {text: () => new Promise<string>((_, reject) => (failFirst = reject))}
                : {text: async () => "5,6"};
        }) as never);

        const first = getGallogActivity("c1");
        // 첫 요청이 응답 없이 1시간 캐시를 넘겨 밀려나고, 다음 호출이 새로 묻는다.
        vi.setSystemTime(Date.now() + 3_600_001);
        const second = getGallogActivity("c1");
        // 두 요청이 다 나간 뒤(csrfBody를 기다린 뒤) 첫 요청을 실패시킨다.
        await vi.waitFor(() => expect(asked).toHaveLength(2));
        failFirst(new Error("network"));
        expect(await first).toBeUndefined();
        expect(await second).toEqual({article: 5, comment: 6});

        expect(await getGallogActivity("c1")).toEqual({article: 5, comment: 6});
        expect(asked).toEqual(["c1", "c1"]);
    });
});
