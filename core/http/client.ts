import ky, {type KyInstance} from "ky";
import pLimit from "p-limit";

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 동시에 보내는 요청 수 — 요청 제한 모듈(features/requests)이 설정대로 바꾼다. 모듈이 꺼져 있거나 다른 페이지(배경·옵션)면 제한 없음 */
const limit = pLimit(Number.POSITIVE_INFINITY);

export const setRequestConcurrency = (concurrency: number): void => {
    limit.concurrency = concurrency;
};

/** 요청을 limit 차례에 맞춰 보낸다 — ky의 재시도도 이 fetch를 다시 부르므로 차례를 지킨다 */
const limited = (fetcher: Fetch): Fetch => (input, init) => limit(() => fetcher(input, init));

const windowFetch: Fetch = globalThis.fetch.bind(globalThis);

/** 파이어폭스 콘텐츠 스크립트에만 있는 페이지 쪽 창 — content.fetch는 페이지의 fetch다 */
const pageWindow = (globalThis as { content?: { fetch: Fetch } }).content;

export const http: KyInstance = ky.create({
    timeout: 15_000,
    fetch: limited(windowFetch),
    // 재시도 시점을 흩어 한꺼번에 다시 몰리지 않게 하고, 서버가 Retry-After로 몇 분을 불러도 10초까지만 기다린다 (그동안 화면이 멈춘 것처럼 보인다)
    retry: {jitter: true, maxRetryAfter: 10_000}
});

/**
 * 디시 ajax — 페이지의 fetch가 있으면(파이어폭스 콘텐츠 스크립트) 그것으로, 없으면 기본 fetch로 보낸다.
 * 파이어폭스 콘텐츠 스크립트의 fetch는 확장 샌드박스에서 나가 Origin/Referer가 빠진다 (#67)
 */
export const ajax: KyInstance = http.extend({
    headers: {"X-Requested-With": "XMLHttpRequest"},
    fetch: limited(pageWindow ? pageWindow.fetch.bind(pageWindow) : windowFetch)
});
