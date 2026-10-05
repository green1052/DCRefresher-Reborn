import {describe, expect, it, vi} from "vitest";

import {getGallogActivity} from "@/core/gallog";

/** 갤로그 응답. 테스트가 바꾼다. */
const gallog = vi.hoisted(() => ({
    bodies: new Array<URLSearchParams>(),
    respond: (_uid: string): Promise<string> => Promise.resolve("")
}));

vi.mock("@/core/http/client", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/http/client")>(),
    ajax: {
        post: (_url: string, {body}: { body: URLSearchParams }) => {
            gallog.bodies.push(body);
            return {text: () => gallog.respond(body.get("user_id") ?? "")};
        }
    }
}));

const deferred = (): { promise: Promise<string>; resolve: (text: string) => void; reject: (e: Error) => void } => {
    const {promise, resolve, reject} = Promise.withResolvers<string>();
    return {promise, resolve, reject};
};

// 캐시가 모듈에 남으므로 테스트마다 다른 uid를 쓴다.
let uidCount = 0;
const uid = (): string => `user${uidCount++}`;

describe("getGallogActivity", () => {
    it("'글,댓글' 응답을 읽고 uid와 CSRF 토큰을 보낸다", async () => {
        gallog.bodies.length = 0;
        gallog.respond = async () => "12,345";
        vi.spyOn(cookieStore, "get").mockResolvedValue({name: "ci_c", value: "token"});
        const id = uid();

        await expect(getGallogActivity(id)).resolves.toEqual({article: 12, comment: 345});
        expect(Object.fromEntries(gallog.bodies[0]!)).toEqual({ci_t: "token", user_id: id});
    });

    it("받는 중인 요청과 받은 값을 같이 쓴다", async () => {
        gallog.bodies.length = 0;
        const response = deferred();
        gallog.respond = () => response.promise;
        const id = uid();

        const first = getGallogActivity(id);
        const second = getGallogActivity(id);
        response.resolve("1,2");
        expect(await first).toEqual({article: 1, comment: 2});
        expect(await second).toEqual({article: 1, comment: 2});
        expect(await getGallogActivity(id)).toEqual({article: 1, comment: 2});
        expect(gallog.bodies).toHaveLength(1);
    });

    it.each([
        ["숫자가 아님", async () => "로그인 필요"],
        ["댓글 수가 없음", async () => "12"],
        ["요청 실패", async () => Promise.reject(new Error("네트워크"))]
    ])("실패하면 undefined이고 다음에 다시 받는다: %s", async (_, respond) => {
        gallog.bodies.length = 0;
        gallog.respond = respond;
        const id = uid();

        expect(await getGallogActivity(id)).toBeUndefined();
        gallog.respond = async () => "3,4";
        expect(await getGallogActivity(id)).toEqual({article: 3, comment: 4});
        expect(gallog.bodies).toHaveLength(2);
    });

    it("1시간이 지나면 다시 받는다", async () => {
        vi.useFakeTimers();
        gallog.bodies.length = 0;
        gallog.respond = async () => "1,1";
        const id = uid();

        await getGallogActivity(id);
        vi.advanceTimersByTime(3_600_000);
        await getGallogActivity(id);
        expect(gallog.bodies).toHaveLength(2);
    });

    it("늦게 실패한 요청은 그사이 새로 들어온 요청을 지우지 않는다", async () => {
        vi.useFakeTimers();
        gallog.bodies.length = 0;
        const stale = deferred();
        const responses = [stale.promise, Promise.resolve("5,6")];
        gallog.respond = () => responses.shift()!;
        const id = uid();

        const first = getGallogActivity(id);
        // 첫 요청이 끝나기 전에 캐시 수명이 다해 새 요청이 들어온다.
        vi.advanceTimersByTime(3_600_000);
        const second = getGallogActivity(id);
        stale.reject(new Error("늦은 실패"));

        expect(await first).toBeUndefined();
        expect(await second).toEqual({article: 5, comment: 6});
        expect(await getGallogActivity(id)).toEqual({article: 5, comment: 6});
        expect(gallog.bodies).toHaveLength(2);
    });
});
