import ky, {type KyInstance} from "ky";

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 파이어폭스 콘텐츠 스크립트의 fetch는 Origin/Referer가 빠지므로(#67) 페이지의 content.fetch를 쓴다. */
const pageWindow = (globalThis as { content?: { fetch: Fetch } }).content;
const baseFetch: Fetch = pageWindow
    ? (input, init) => new Promise((resolve, reject) => {
        pageWindow.fetch(input, init).then(resolve, reject);
    })
    : globalThis.fetch.bind(globalThis);

// 시간 제한은 걸지 않는다 - 모든 요청에 호출 쪽 AbortSignal이 붙어 있어 사용자가 끊는다.
export const http: KyInstance = ky.create({
    timeout: false,
    totalTimeout: false,
    fetch: baseFetch,
    retry: 0
});

/** 폼 본문. null, undefined, false 필드는 뺀다 (URLSearchParams는 undefined를 글자로 넣는다). */
export const formBody = (fields: Record<string, string | null | undefined | false>): URLSearchParams =>
    new URLSearchParams(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string"));

export const ajax: KyInstance = http.extend({headers: {"X-Requested-With": "XMLHttpRequest"}});
