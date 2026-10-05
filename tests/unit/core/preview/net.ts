/** 디시 요청 가짜 응답. 테스트 파일은 core/http/client를 불러오기 전에 fetch를 바꿔 둔다 (client가 불러올 때 fetch를 붙잡는다). */
import type {Mock} from "vitest";

export interface Sent {
    url: string;
    method: string;
    body: URLSearchParams;
    signal: AbortSignal;
}

type Reply = string | Response;

/** 받은 요청을 모으고 reply의 값(문자열이면 200 본문)으로 응답한다. */
export const serve = (fetchMock: Mock<typeof fetch>, reply: (sent: Sent) => Reply | Promise<Reply>): Sent[] => {
    const sent: Sent[] = [];
    fetchMock.mockImplementation(async (input, init) => {
        const request = new Request(input, init);
        const item = {url: request.url, method: request.method, body: new URLSearchParams(await request.text()), signal: request.signal};
        sent.push(item);
        const response = await reply(item);
        return typeof response === "string" ? new Response(response) : response;
    });
    return sent;
};
