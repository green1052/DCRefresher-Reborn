import ky, {type KyInstance} from "ky";

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

// 시간 제한은 걸지 않는다. 모든 요청에 호출한 쪽의 AbortSignal이 붙어 있어 사용자가 창을 닫거나 페이지를
// 떠나면 끊긴다. 서버가 침묵하는 드문 경우 스피너가 오래 돌지만 사용자가 다른 행동을 하면 곧 끊긴다.
export const http: KyInstance = ky.create({
    timeout: false,
    totalTimeout: false,
    fetch: baseFetch,
    retry: 0
});

/**
 * 폼 본문(application/x-www-form-urlencoded). 값이 null·undefined·false인 필드는 넣지 않는다.
 * URLSearchParams는 undefined를 "undefined"라는 글자로 넣는다. ky도 이런 처리는 URL 쿼리(searchParams)에만 한다.
 * 빈 문자열은 넣는다 (디시가 빈 값으로 받는 필드가 있다).
 */
export const formBody = (fields: Record<string, string | null | undefined | false>): URLSearchParams =>
    new URLSearchParams(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string"));

export {isAbortError} from "@/utils/error";

export const ajax: KyInstance = http.extend({headers: {"X-Requested-With": "XMLHttpRequest"}});
