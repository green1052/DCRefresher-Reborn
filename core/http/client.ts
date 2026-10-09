import ky, {type AfterResponseHook, type KyInstance} from "ky";
import pLimit from "p-limit";

import {isBlockedPage} from "@/core/pages";

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * 파이어폭스 콘텐츠 스크립트에만 있는 전역 content. content.fetch는 페이지 컨텍스트의 fetch라 페이지가 보낸 요청처럼 나간다.
 * 콘텐츠 스크립트 자체의 fetch는 확장 샌드박스에서 나가 Origin/Referer가 빠진다 (#67). 크롬 콘텐츠 스크립트와 배경·옵션 페이지는 기본 fetch다.
 * content.fetch가 준 Promise는 페이지 영역의 것이라, 거기에 finally 등으로 이은 Promise는 이쪽에서 기다려도 받은 쪽이 없는 것으로 쳐서
 * 끊은 요청마다 AbortError가 콘솔에 남는다. then으로 바로 이 영역의 Promise에 옮겨 담는다.
 */
const pageWindow = (globalThis as { content?: { fetch: Fetch } }).content;
const baseFetch: Fetch = pageWindow
    ? (input, init) => new Promise((resolve, reject) => {
        pageWindow.fetch(input, init).then(resolve, reject);
    })
    : globalThis.fetch.bind(globalThis);

/** 동시 요청 수. 요청 제한 모듈(features/requests)이 설정값으로 바꾸고, 모듈이 꺼져 있거나 배경·옵션 페이지면 무제한이다. */
const limiter = pLimit(Number.POSITIVE_INFINITY);

/** 1 이상의 정수나 Infinity여야 한다 (아니면 던진다). 설정값은 normalizeSetting이 step 단위로 맞춘다. */
export const setRequestConcurrency = (concurrency: number): void => {
    limiter.concurrency = concurrency;
};

/** 요청 한 번의 시간 제한 (ms). */
const REQUEST_TIMEOUT = 15_000;

/**
 * fetch 단위로 동시 요청 수를 제한한다. ky의 재시도도 이 fetch를 다시 부르므로 재시도 요청도 동시 요청 수에 들어간다.
 * 시간 제한은 자리를 잡은 뒤부터 응답 머리를 받을 때까지 잰다. ky의 timeout은 fetch를 부르는 순간부터 재서, 요청이 몰리면 차례를 기다리던 요청이
 * 보내지도 못하고 시간 초과로 실패한다. 머리를 받으면 타이머를 지운다. 남겨 두면 느린 회선에서 본문(IP DB 등)을 받는 도중에 끊는다.
 * 요청을 끊는 신호(ky·호출한 쪽)는 Request에 들어 있어 함께 건다.
 */
const limitedFetch: Fetch = (input, init) =>
    limiter(() => {
        // AbortSignal.timeout은 파이어폭스 콘텐츠 스크립트에서 "Could not find window"로 던진다 (전역이 창이 아니라 샌드박스다).
        const timeout = new AbortController();
        const timer = setTimeout(() => timeout.abort(new DOMException("요청 시간 초과", "TimeoutError")), REQUEST_TIMEOUT);
        const signals = [timeout.signal];
        if (input instanceof Request) signals.push(input.signal);
        if (init?.signal) signals.push(init.signal);
        return baseFetch(input, {...init, signal: AbortSignal.any(signals)}).finally(() => clearTimeout(timer));
    });

/** 디시 임시 차단을 받았을 때 던지는 오류. 요청이 너무 많으면 디시는 상태 코드 없이 모든 요청에 빈 페이지를 준다. */
export class BlockedError extends Error {
    override name = "BlockedError";
}

let onBlocked: (() => void) | undefined;

/** 임시 차단을 받을 때마다 부를 함수 (콘텐츠 스크립트가 알림을 건다). */
export const setBlockedHandler = (handler: () => void): void => {
    onBlocked = handler;
};

/**
 * 빈 응답이면 임시 차단으로 본다. 글·목록·검색 페이지(GET)와 /board/comment/ 아래 요청(댓글 목록 JSON, 댓글 삭제)만 본다.
 * 댓글 삭제 응답은 'true'나 'false||…'라 비어 있지 않다. 다른 ajax(글 삭제·추천 등)는 성공 응답이 비어 있을 수 있어 보지 않는다.
 */
const detectBlocked: AfterResponseHook = async ({request, response}) => {
    const url = new URL(request.url);
    if (!response.ok || !url.hostname.endsWith("dcinside.com")) return;
    if (request.method !== "GET" && !url.pathname.startsWith("/board/comment/")) return;
    if (!isBlockedPage(await response.clone().text())) return;

    onBlocked?.();
    throw new BlockedError("디시인사이드 임시 차단");
};

export const http: KyInstance = ky.create({
    // 시간 제한은 limitedFetch가 차례를 받은 뒤부터 잰다.
    timeout: false,
    fetch: limitedFetch,
    // jitter: 재시도가 한꺼번에 몰리지 않게 시점을 흩는다.
    // maxRetryAfter: Retry-After가 몇 분이어도 10초까지만 기다린다. 더 기다리면 화면이 멈춘 것처럼 보인다.
    retry: {jitter: true, maxRetryAfter: 10_000},
    hooks: {afterResponse: [detectBlocked]}
});

/**
 * 폼 본문(application/x-www-form-urlencoded). 값이 null·undefined·false인 필드는 넣지 않는다.
 * URLSearchParams는 undefined를 "undefined"라는 글자로 넣는다. ky도 이런 처리는 URL 쿼리(searchParams)에만 한다.
 * 빈 문자열은 넣는다 (디시가 빈 값으로 받는 필드가 있다).
 */
export const formBody = (fields: Record<string, string | null | undefined | false>): URLSearchParams =>
    new URLSearchParams(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string"));

/** 끊은 요청(AbortController)의 오류인지. 파이어폭스 content.fetch의 오류는 다른 영역 객체라 instanceof Error가 틀릴 수 있어 이름으로 본다. */
export const isAbortError = (e: unknown): boolean => typeof e === "object" && e !== null && "name" in e && e.name === "AbortError";

export const ajax: KyInstance = http.extend({headers: {"X-Requested-With": "XMLHttpRequest"}});
