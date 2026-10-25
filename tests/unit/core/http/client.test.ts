// @vitest-environment node
import {afterEach, describe, expect, it, vi} from "vitest";

import {ajax, formBody, http} from "@/core/http/client";
import {isAbortError} from "@/utils/error";

/** 클라이언트가 불러올 때 fetch를 잡아 두므로 그 전에 바꾼다. 응답은 테스트가 정한다. */
const network = vi.hoisted(() => {
    const state = {
        requests: new Array<Request>(),
        respond: (_request: Request): Promise<Response> => Promise.resolve(new Response("ok"))
    };
    Object.assign(globalThis, {
        fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const request = new Request(input, init);
            state.requests.push(request);
            return state.respond(request);
        }
    });
    return state;
});

/** 신호가 끊기면 거부되고, 아니면 resolve를 부를 때까지 기다리는 응답. */
const pending = (request: Request): { promise: Promise<Response>; resolve: () => void } => {
    const {promise, resolve, reject} = Promise.withResolvers<Response>();
    request.signal.addEventListener("abort", () => reject(request.signal.reason));
    return {promise, resolve: () => resolve(new Response("ok"))};
};

afterEach(() => {
    network.requests.length = 0;
    network.respond = () => Promise.resolve(new Response("ok"));
});

describe("시간 제한", () => {
    it("머리를 받은 뒤에는 시간 제한으로 끊지 않는다", async () => {
        vi.useFakeTimers();
        network.respond = async () => new Response("ok");
        await http.get("https://example.com/", {retry: 0}).text();
        await vi.advanceTimersByTimeAsync(20_000);
        expect(network.requests[0]!.signal.aborted).toBe(false);
    });

    it("본문이 멈추면 요청 전체 시간 제한(60초)에 끊는다", async () => {
        vi.useFakeTimers();
        // 머리만 오고 본문이 끝나지 않는 응답. 디시 GET은 차단 검사가, 그 밖은 .text()가 본문을 읽는다.
        network.respond = async () => new Response(new ReadableStream());
        for (const url of ["https://gall.dcinside.com/board/lists?id=a", "https://example.com/"]) {
            const failed = expect(http.get(url, {retry: 0}).text()).rejects.toMatchObject({name: "TimeoutError"});
            await vi.advanceTimersByTimeAsync(60_000);
            await failed;
        }
    });

    it("호출한 쪽이 끊으면 보낸 요청도 끊긴다", async () => {
        network.respond = (request) => pending(request).promise;
        const controller = new AbortController();
        const request = http.get("https://example.com/", {retry: 0, signal: controller.signal}).text();
        await vi.waitFor(() => expect(network.requests).toHaveLength(1));
        controller.abort();
        await expect(request).rejects.toSatisfy(isAbortError);
    });
});

describe("ajax", () => {
    it("XMLHttpRequest 머리를 붙인다", async () => {
        await ajax.post("https://gall.dcinside.com/board/forms/comment_submit").text();
        expect(network.requests[0]!.headers.get("X-Requested-With")).toBe("XMLHttpRequest");
        await http.get("https://example.com/").text();
        expect(network.requests[1]!.headers.has("X-Requested-With")).toBe(false);
    });
});

describe("formBody", () => {
    it("null·undefined·false는 빼고 빈 문자열은 넣는다", () => {
        expect(formBody({a: "1", b: "", c: null, d: undefined, e: false}).toString()).toBe("a=1&b=");
    });
});
