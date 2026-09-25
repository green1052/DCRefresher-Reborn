import ky, {type KyInstance} from "ky";

const fetchFn: typeof fetch = (globalThis.fetch ?? window.fetch).bind(globalThis);

export const http: KyInstance = ky.create({
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
        fetchFn(input, init)) as typeof fetch,
    timeout: 15_000
});

export const ajax: KyInstance = http.extend({headers: {"X-Requested-With": "XMLHttpRequest"}});
