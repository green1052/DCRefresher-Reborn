import {beforeEach, describe, expect, it, vi} from "vitest";

import {urls} from "@/core/http/urls";
import {encodeIpData, type IpCandidate, IP_FORMAT} from "@/core/ipdb";
import {DB_KEYS, rawKey} from "@/core/storage/items";

import {stored, tick} from "../../helpers";

/** 서버 파일 (주소 → 본문). 없는 주소는 실패한다. */
const server = vi.hoisted(() => ({files: new Map<string, string>(), requested: new Array<string>(), caches: new Array<string | undefined>()}));

vi.mock("@/core/http/client", () => ({
    http: {
        get: (url: string, options?: { cache?: string }) => ({
            text: async () => {
                server.requested.push(url);
                server.caches.push(options?.cache);
                const text = server.files.get(url);
                if (text === undefined) throw new Error(`404 ${url}`);
                return text;
            }
        })
    }
}));

const META = "refresher:db:meta";
const IP = rawKey(DB_KEYS.ip);
const BAN = rawKey(DB_KEYS.ban);

const ipJson = (prefixes: [string, IpCandidate[]][], version?: string): string => {
    const slots = new Map(prefixes.map(([prefix, candidates]) => {
        const [a = 0, b = 0] = prefix.split(".").map(Number);
        return [a * 256 + b, candidates];
    }));
    return JSON.stringify({...encodeIpData(slots), version});
};

/** 모듈 상태(once·밴 캐시)를 테스트마다 새로 시작한다. */
const load = async (): Promise<typeof import("@/core/database")> => {
    vi.resetModules();
    return import("@/core/database");
};

beforeEach(() => {
    server.files.clear();
    server.requested.length = 0;
    server.caches.length = 0;
});

describe("updateDatabase", () => {
    const serve = (version: string, ip: string, ban = "{}"): void => {
        server.files.set(urls.database.version, version);
        server.files.set(urls.database.ip, ip);
        server.files.set(urls.database.ban, ban);
    };

    it("버전이 다르면 받아서 그대로 저장한다", async () => {
        const {updateDatabase} = await load();
        const ip = ipJson([["1.2", [{org: "KT", vpn: false}]]]);
        serve("v2\n", ip, "{\"갤\":[\"uid\"]}");
        vi.spyOn(Date, "now").mockReturnValue(1000);

        await updateDatabase();
        expect(await stored(META)).toEqual({version: "v2", lastUpdate: 1000, format: IP_FORMAT});
        expect(await stored(IP)).toBe(ip);
        expect(await stored(BAN)).toBe("{\"갤\":[\"uid\"]}");
        // 브라우저 캐시(서버가 1시간 캐시하라고 준다)의 옛 파일을 쓰지 않게 매번 서버에 확인한다.
        expect(server.caches).toEqual(["no-cache", "no-cache", "no-cache"]);
    });

    it("ip.json에 버전이 있으면 그것을 저장한다", async () => {
        const {updateDatabase} = await load();
        // CDN이 새 version과 옛 ip.json을 주면 다음 확인 때 다시 받아야 한다.
        serve("v2", ipJson([], "v1"));
        await updateDatabase();
        expect(await stored(META)).toMatchObject({version: "v1"});
    });

    it("버전과 형식이 같으면 확인 시각만 바꾸고 본문은 받지 않는다", async () => {
        const {updateDatabase} = await load();
        await browser.storage.local.set({[META]: {version: "v1", lastUpdate: 1, format: IP_FORMAT}, [IP]: "old"});
        serve("v1", ipJson([]));
        vi.spyOn(Date, "now").mockReturnValue(5000);

        await updateDatabase();
        expect(server.requested).toEqual([urls.database.version]);
        expect(await stored(META)).toEqual({version: "v1", lastUpdate: 5000, format: IP_FORMAT});
        expect(await stored(IP)).toBe("old");
    });

    it("저장 형식이 옛것이면 버전이 같아도 다시 받는다", async () => {
        const {updateDatabase} = await load();
        await browser.storage.local.set({[META]: {version: "v1", lastUpdate: 1}});
        serve("v1", ipJson([]));
        await updateDatabase();
        expect(server.requested).toContain(urls.database.ip);
        expect(await stored(META)).toMatchObject({format: IP_FORMAT});
    });

    it("force면 같은 버전이어도 다시 받는다", async () => {
        const {updateDatabase} = await load();
        await browser.storage.local.set({[META]: {version: "v1", lastUpdate: 1, format: IP_FORMAT}});
        serve("v1", ipJson([]));
        await updateDatabase(true);
        expect(server.requested).toContain(urls.database.ip);
    });

    it("서버 버전이 비었으면 다시 받는다", async () => {
        const {updateDatabase} = await load();
        await browser.storage.local.set({[META]: {version: "", lastUpdate: 1, format: IP_FORMAT}});
        serve("  ", ipJson([]));
        await updateDatabase();
        expect(server.requested).toContain(urls.database.ip);
    });

    it.each([
        ["ip.json이 옛 형식", "{\"1.2\":{}}", "{}"],
        ["ip.json이 깨짐", "{", "{}"],
        ["ip.json의 구간이 틀림", JSON.stringify({runs: new Uint8Array(Uint16Array.from([0, 0, 0]).buffer).toBase64(), orgs: [], countries: [], meta: [], lists: []}), "{}"],
        ["ban.json이 깨짐", ipJson([]), "{"]
    ])("받은 파일이 잘못됐으면 던지고 DB를 바꾸지 않는다: %s", async (_, ip, ban) => {
        const {updateDatabase} = await load();
        await browser.storage.local.set({[META]: {version: "v1", lastUpdate: 1}, [IP]: "old", [BAN]: "old"});
        serve("v2", ip, ban);
        await expect(updateDatabase()).rejects.toThrow();
        expect(await stored(META)).toEqual({version: "v1", lastUpdate: 1});
        expect(await stored(IP)).toBe("old");
        expect(await stored(BAN)).toBe("old");
    });
});

describe("ipInfoOf", () => {
    const setup = async (prefixes: [string, IpCandidate[]][]): Promise<typeof import("@/core/database")> => {
        await browser.storage.local.set({[IP]: ipJson(prefixes)});
        const database = await load();
        await database.initDatabase();
        return database;
    };

    it("한국 조직은 국가를 붙이지 않는다", async () => {
        const {ipInfoOf} = await setup([["1.2", [{org: "KT", vpn: false}, {org: "부산은행", vpn: false}]]]);
        expect(ipInfoOf("1.2.3.4")).toEqual({label: "KT, 부산은행", title: "KT\n부산은행", category: "korea"});
    });

    it("첫 후보의 국가·VPN으로 표시와 구분을 정하고 VPN이 국가보다 앞선다", async () => {
        const {ipInfoOf} = await setup([
            ["1.1", [{org: "SoftBank", country: "일본", vpn: false}]],
            ["1.2", [{org: "Tencent", country: "중국", vpn: true}, {org: "KT", vpn: false}]],
            ["1.3", [{org: "China Telecom", country: "중국", vpn: false}]],
            ["1.4", [{country: "미국", vpn: false}]]
        ]);
        expect(ipInfoOf("1.1")).toMatchObject({label: "SoftBank (일본)", category: "japan"});
        expect(ipInfoOf("1.2")).toEqual({label: "Tencent, KT (VPN)", title: "Tencent (VPN)\nKT", category: "vpn"});
        expect(ipInfoOf("1.3")).toMatchObject({category: "china"});
        expect(ipInfoOf("1.4")).toEqual({label: "미국", title: "(조직 미상) (미국)", category: "foreign"});
    });

    it("조직은 셋까지 보이고 나머지는 수로 줄인다", async () => {
        const orgs = ["A", "B", "C", "D", "E", "A"].map((org) => ({org, vpn: false}));
        const {ipInfoOf} = await setup([["1.2", orgs]]);
        expect(ipInfoOf("1.2")?.label).toBe("A, B, C 외 2");
    });

    it("데이터가 없거나 깨졌으면 undefined이고 던지지 않는다", async () => {
        const {ipInfoOf} = await setup([["1.2", [{org: "KT", vpn: false}]]]);
        expect(ipInfoOf("9.9")).toBeUndefined();

        vi.spyOn(console, "error").mockImplementation(() => {});
        await browser.storage.local.set({[IP]: "{"});
        const broken = await load();
        await expect(broken.initDatabase()).resolves.toBeUndefined();
        expect(broken.ipInfoOf("1.2")).toBeUndefined();
    });

    it("저장소의 IP DB가 바뀌면 따라가고 번호를 올린다", async () => {
        const {ipInfoOf, databaseVersion} = await setup([["1.2", [{org: "KT", vpn: false}]]]);
        const before = databaseVersion();
        await browser.storage.local.set({[IP]: ipJson([["1.2", [{org: "SKT", vpn: false}]]])});
        await tick();
        expect(ipInfoOf("1.2")?.label).toBe("SKT");
        expect(databaseVersion()).toBeGreaterThan(before);
    });

    it("감시를 풀면 더 따라가지 않는다", async () => {
        const {ipInfoOf, releaseDatabase} = await setup([["1.2", [{org: "KT", vpn: false}]]]);
        releaseDatabase();
        await browser.storage.local.set({[IP]: ipJson([["1.2", [{org: "SKT", vpn: false}]]])});
        await tick();
        expect(ipInfoOf("1.2")?.label).toBe("KT");
    });

    it("bfcache에서 돌아오면 DB 버전이 바뀌었을 때만 다시 읽는다", async () => {
        await browser.storage.local.set({[META]: {version: "v1", lastUpdate: 1, format: IP_FORMAT}});
        const {databaseVersion} = await setup([["1.2", [{org: "KT", vpn: false}]]]);
        const restore = (): boolean => window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted: true}));

        const before = databaseVersion();
        restore();
        await tick();
        expect(databaseVersion()).toBe(before);

        await browser.storage.local.set({[META]: {version: "v2", lastUpdate: 1, format: IP_FORMAT}});
        restore();
        await vi.waitFor(() => expect(databaseVersion()).toBe(before + 1));
    });

    it("구독하면 DB를 읽기 시작한다", async () => {
        await browser.storage.local.set({[IP]: ipJson([["1.2", [{org: "KT", vpn: false}]]])});
        const {subscribeDatabase, ipInfoOf} = await load();
        const listener = vi.fn();
        subscribeDatabase(listener);
        await vi.waitFor(() => expect(listener).toHaveBeenCalled());
        expect(ipInfoOf("1.2")?.label).toBe("KT");
    });
});

describe("passesIpFilter", () => {
    it("필터마다 보일 구분을 가린다", async () => {
        const {passesIpFilter} = await load();
        const categories = ["korea", "japan", "china", "foreign", "vpn"] as const;
        const passing = (filter: "all" | "foreign" | "vpn" | "none"): string[] =>
            categories.filter((category) => passesIpFilter({label: "", title: "", category}, filter));
        expect(passing("all")).toEqual([...categories]);
        expect(passing("foreign")).toEqual(["japan", "china", "foreign", "vpn"]);
        expect(passing("vpn")).toEqual(["vpn"]);
        expect(passing("none")).toEqual([]);
    });
});

describe("banReasonsOf", () => {
    it("처음 부르면 읽기 시작하고 다 읽으면 이유들을 돌려준다", async () => {
        await browser.storage.local.set({[BAN]: JSON.stringify({갤1: ["a", "b"], 갤2: ["a", 3], 깨짐: "a"})});
        const {banReasonsOf} = await load();
        expect(banReasonsOf("a")).toBeUndefined();
        await vi.waitFor(() => expect(banReasonsOf("a")).toBe("갤1, 갤2"));
        expect(banReasonsOf("b")).toBe("갤1");
        expect(banReasonsOf("3")).toBeUndefined();
        expect(banReasonsOf("c")).toBeUndefined();
    });

    it("읽은 뒤에는 저장소의 밴 DB 변경을 따라간다", async () => {
        await browser.storage.local.set({[BAN]: JSON.stringify({갤1: ["a"]})});
        const {banReasonsOf, initDatabase} = await load();
        await initDatabase();
        banReasonsOf("a");
        await vi.waitFor(() => expect(banReasonsOf("a")).toBe("갤1"));

        await browser.storage.local.set({[BAN]: JSON.stringify({갤2: ["a"]})});
        await vi.waitFor(() => expect(banReasonsOf("a")).toBe("갤2"));
    });

    it("밴 DB가 깨졌으면 빈 목록으로 본다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await browser.storage.local.set({[BAN]: "{"});
        const {banReasonsOf, databaseVersion} = await load();
        banReasonsOf("a");
        await vi.waitFor(() => expect(databaseVersion()).toBeGreaterThan(0));
        expect(banReasonsOf("a")).toBeUndefined();
    });
});
