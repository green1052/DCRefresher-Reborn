import {afterEach, describe, expect, it, vi} from "vitest";

import {ajax, BlockedError, formBody, http, isAbortError, setBlockedHandler, setRequestConcurrency} from "@/core/http/client";

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
    setRequestConcurrency(Number.POSITIVE_INFINITY);
    setBlockedHandler(() => {});
});

describe("임시 차단 검사", () => {
    const empty = "<html><head></head><body>\n</body></html>";

    it("디시 GET이 빈 문서면 BlockedError를 던지고 알림을 부른다", async () => {
        const onBlocked = vi.fn();
        setBlockedHandler(onBlocked);
        network.respond = async () => new Response(empty);
        await expect(http.get("https://gall.dcinside.com/board/lists?id=a").text()).rejects.toBeInstanceOf(BlockedError);
        expect(onBlocked).toHaveBeenCalledOnce();
    });

    it("디시의 모든 GET 페이지를 본다", async () => {
        network.respond = async () => new Response("");
        await expect(http.get("https://gall.dcinside.com/mgallery/board/lists?id=a").text()).rejects.toBeInstanceOf(BlockedError);
    });

    it("POST는 댓글 요청만 본다", async () => {
        network.respond = async () => new Response("");
        await expect(http.post("https://gall.dcinside.com/board/comment/").text()).rejects.toBeInstanceOf(BlockedError);
        // 글 삭제 등은 성공 응답이 비어 있을 수 있다.
        await expect(http.post("https://gall.dcinside.com/board/forms/delete_submit").text()).resolves.toBe("");
    });

    it("본문이 있거나 디시가 아니거나 다른 POST면 지나간다", async () => {
        const onBlocked = vi.fn();
        setBlockedHandler(onBlocked);
        network.respond = async () => new Response(empty);
        await expect(http.get("https://dcrefresher.green1052.com/version").text()).resolves.toBe(empty);
        await expect(http.post("https://gall.dcinside.com/ajax/recommend").text()).resolves.toBe(empty);

        network.respond = async () => new Response("<body><div>글</div></body>");
        await expect(http.get("https://gall.dcinside.com/board/view?id=a&no=1").text()).resolves.toContain("글");
        expect(onBlocked).not.toHaveBeenCalled();
    });

    it("실패 응답은 차단으로 보지 않는다", async () => {
        network.respond = async () => new Response("", {status: 404});
        await expect(http.get("https://gall.dcinside.com/board/lists").text()).rejects.toMatchObject({name: "HTTPError"});
    });
});

describe("동시 요청 수", () => {
    it("정한 수만큼만 동시에 보낸다", async () => {
        setRequestConcurrency(1);
        const responses: (() => void)[] = [];
        network.respond = (request) => {
            const {promise, resolve} = pending(request);
            responses.push(resolve);
            return promise;
        };

        const first = http.get("https://example.com/1", {retry: 0}).text();
        const second = http.get("https://example.com/2", {retry: 0}).text();
        await vi.waitFor(() => expect(network.requests).toHaveLength(1));
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(network.requests).toHaveLength(1);

        responses[0]!();
        await first;
        await vi.waitFor(() => expect(network.requests).toHaveLength(2));
        responses[1]!();
        await second;
    });

    it("시간 제한은 차례를 받은 뒤부터 잰다", async () => {
        vi.useFakeTimers();
        setRequestConcurrency(1);
        network.respond = (request) => pending(request).promise;

        const first = http.get("https://example.com/1", {retry: 0}).text();
        const second = http.get("https://example.com/2", {retry: 0}).text();
        const firstFailed = expect(first).rejects.toMatchObject({name: "TimeoutError"});
        const secondFailed = expect(second).rejects.toMatchObject({name: "TimeoutError"});

        await vi.advanceTimersByTimeAsync(15_000);
        await firstFailed;
        // 두 번째 요청은 첫 요청이 끝난 뒤에 보냈으므로 아직 끊기지 않았다.
        expect(network.requests).toHaveLength(2);
        expect(network.requests[1]!.signal.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(15_000);
        await secondFailed;
    });

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
