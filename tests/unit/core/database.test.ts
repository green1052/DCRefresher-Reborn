import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

// database.ts가 쓰는 HTTP 클라이언트는 모듈을 읽는 순간 fetch를 잡아 두므로 가짜를 먼저 박는다.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const {updateDatabase} = await import("@/core/database");
const {IP_FORMAT} = await import("@/core/ipdb");
const {urls} = await import("@/core/http/urls");

/** 받은 쪽이 문서 없이 JSON/텍스트로 오는 MaxMind 형식이 아니라 그냥 텍스트라고 표현하지 않는다 — 확장 DB 파일은 텍스트다. */
const page = (body: string): Response => new Response(body, {status: 200});

/** 받은 적 없는 유효한 최소 IP DB (대역 1개: 0.0.0.0/16 → KT 한국). */
const ipJson = (): string => JSON.stringify({
    version: "v2",
    runs: new Uint8Array(new Uint16Array([0, 1]).buffer).toBase64(),
    orgs: ["KT"],
    countries: [""],
    meta: [0, 0, 0],
    lists: []
});

/** 엔드포인트별 응답을 단다. */
const stub = (bodyOf: Record<string, string>): void => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = String(input instanceof Request ? input.url : input);
        for (const [suffix, body] of Object.entries(bodyOf)) {
            if (url.endsWith(suffix)) return Promise.resolve(page(body));
        }
        return Promise.reject(new Error(`예상 밖의 요청: ${url}`));
    });
};

const storedMeta = async (): Promise<unknown> => (await fakeBrowser.storage.local.get("refresher:db:meta"))["refresher:db:meta"];

describe("updateDatabase", () => {
    it("버전과 형식이 같으면 확인 시각만 갱신하고 본문은 받지 않는다", async () => {
        await fakeBrowser.storage.local.set({"refresher:db:meta": {version: "v1", lastUpdate: 1, format: IP_FORMAT}});
        stub({"version": "v1"});

        await updateDatabase();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        // ky는 fetch에 Request를 넘기므로 주소만 문자열로 본다.
        const requested = fetchMock.mock.calls[0]![0];
        expect(String(requested instanceof Request ? requested.url : requested)).toBe(urls.database.version);
        expect(await storedMeta()).toMatchObject({version: "v1", format: IP_FORMAT, lastUpdate: expect.any(Number)});
        expect((await fakeBrowser.storage.local.get("refresher:db:ip"))["refresher:db:ip"]).toBeUndefined();
    });

    it("버전이 다르면 세 파일을 받아 그대로 저장한다. ip.json의 버전이 우선한다(CDN 캐시 어긋남 대비)", async () => {
        await fakeBrowser.storage.local.set({"refresher:db:meta": {version: "v1", lastUpdate: 1, format: IP_FORMAT}});
        stub({"version": "v2", "ip.json": ipJson(), "ban.json": "{}"});

        await updateDatabase();

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect((await fakeBrowser.storage.local.get("refresher:db:ip"))["refresher:db:ip"]).toBe(ipJson());
        expect((await fakeBrowser.storage.local.get("refresher:db:ban"))["refresher:db:ban"]).toBe("{}");
        expect(await storedMeta()).toMatchObject({version: "v2", format: IP_FORMAT});
    });

    it("저장 형식이 옛것이면 버전이 같아도 다시 받는다", async () => {
        await fakeBrowser.storage.local.set({"refresher:db:meta": {version: "v1", lastUpdate: 1}});
        stub({"version": "v1", "ip.json": ipJson(), "ban.json": "{}"});

        await updateDatabase();

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(await storedMeta()).toMatchObject({version: "v2", format: IP_FORMAT});
    });

    it("ip.json이 깨졌으면 던지고 DB를 바꾸지 않는다", async () => {
        await fakeBrowser.storage.local.set({"refresher:db:meta": {version: "v1", lastUpdate: 1, format: IP_FORMAT}});
        stub({"version": "v9", "ip.json": "{not json", "ban.json": "{}"});

        await expect(updateDatabase()).rejects.toThrow();
        expect((await fakeBrowser.storage.local.get("refresher:db:ip"))["refresher:db:ip"]).toBeUndefined();
        expect(await storedMeta()).toMatchObject({version: "v1"});
    });

    it("force면 버전과 형식이 같아도 다시 받는다 (지금 갱신)", async () => {
        await fakeBrowser.storage.local.set({"refresher:db:meta": {version: "v2", lastUpdate: 1, format: IP_FORMAT}});
        stub({"version": "v2", "ip.json": ipJson(), "ban.json": "{}"});

        await updateDatabase(true);

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(await storedMeta()).toMatchObject({version: "v2", format: IP_FORMAT, lastUpdate: expect.any(Number)});
    });
});
