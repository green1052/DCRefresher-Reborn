import ky, {type KyInstance} from "ky";

export const http: KyInstance = ky.create({timeout: 15_000});

/** 파이어폭스 콘텐츠 스크립트의 fetch는 확장 샌드박스에서 나가 Origin/Referer가 빠진다 — 디시 ajax는 페이지의 fetch로 보낸다 (#67) */
const page = import.meta.env.FIREFOX && location.origin === "https://gall.dcinside.com"
    ? (globalThis as { content?: { fetch: typeof fetch } }).content
    : undefined;

export const ajax: KyInstance = http.extend({
    headers: {"X-Requested-With": "XMLHttpRequest"},
    ...(page && {fetch: page.fetch.bind(page)})
});
