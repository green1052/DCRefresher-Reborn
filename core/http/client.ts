import ky, {type KyInstance} from "ky";

const fetchFn: typeof fetch = (globalThis.fetch ?? window.fetch).bind(globalThis);

// Firefox(MV2/MV3)의 CSP 문제로 content-script 컨텍스트의 fetch를 명시적으로 바인딩해 넘긴다.
export const http: KyInstance = ky.create({
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
        fetchFn(input, init)) as typeof fetch,
    timeout: 15_000
});
