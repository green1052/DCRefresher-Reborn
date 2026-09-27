import ky, {type KyInstance} from "ky";
import pLimit from "p-limit";

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 동시 요청 수. 요청 제한 모듈(features/requests)이 설정값으로 바꾸고, 모듈이 꺼져 있거나 배경·옵션 페이지면 무제한이다 */
const limit = pLimit(Number.POSITIVE_INFINITY);

export const setRequestConcurrency = (concurrency: number): void => {
    limit.concurrency = concurrency;
};

/** fetch 단위로 limit을 건다. ky의 재시도도 이 fetch를 다시 부르므로 재시도 요청도 동시 요청 수에 들어간다 */
const limited = (fetcher: Fetch): Fetch => (input, init) => limit(() => fetcher(input, init));

/**
 * 파이어폭스 콘텐츠 스크립트에만 있는 전역 content. content.fetch는 페이지 컨텍스트의 fetch라 페이지가 보낸 요청처럼 나간다.
 * 콘텐츠 스크립트 자체의 fetch는 확장 샌드박스에서 나가 Origin/Referer가 빠진다 (#67). 크롬 콘텐츠 스크립트와 배경·옵션 페이지는 기본 fetch다
 */
const pageWindow = (globalThis as { content?: { fetch: Fetch } }).content;
const baseFetch: Fetch = pageWindow ? pageWindow.fetch.bind(pageWindow) : globalThis.fetch.bind(globalThis);

export const http: KyInstance = ky.create({
    timeout: 15_000,
    fetch: limited(baseFetch),
    // jitter: 재시도가 한꺼번에 몰리지 않게 시점을 흩는다.
    // maxRetryAfter: Retry-After가 몇 분이어도 10초까지만 기다린다. 더 기다리면 화면이 멈춘 것처럼 보인다.
    retry: {jitter: true, maxRetryAfter: 10_000}
});

/** 디시 ajax 요청용 */
export const ajax: KyInstance = http.extend({headers: {"X-Requested-With": "XMLHttpRequest"}});
