import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {banReasonsOf, initDatabase, ipInfoOf, parseBans} from "@/core/database";
import {encodeIpData} from "@/core/ipdb";

describe("parseBans", () => {
    it("uid 문자열 배열인 항목만 남기고, 비었으면 빈 목록이다", () => {
        expect(parseBans("")).toEqual({});
        expect(parseBans(JSON.stringify({도배: ["a", 1, "b"], 메모: "x", 광고: []}))).toEqual({도배: ["a", "b"], 광고: []});
        expect(parseBans("[1]")).toEqual({});
        expect(() => parseBans("{")).toThrow();
    });
});

// initDatabase는 한 번만 읽고(once) 모듈 상태에 둔다. 이 파일에서는 이 묶음 하나만 부른다.
describe("ipInfoOf / banReasonsOf", () => {
    it("저장된 DB로 IP 정보와 갱차 이유를 보인다", async () => {
        const ip = encodeIpData(new Map([
            [1 * 256 + 2, [{org: "가", vpn: false}, {org: "나", vpn: false}, {org: "다", vpn: false}, {org: "라", vpn: false}]],
            [3 * 256 + 4, [{org: "X", country: "일본", vpn: true}]],
            [5 * 256 + 6, [{country: "중국", vpn: false}]]
        ]));
        await fakeBrowser.storage.local.set({
            "refresher:db:ip": JSON.stringify(ip),
            "refresher:db:ban": JSON.stringify({도배: ["u1"], 광고: ["u1", "u2"]})
        });
        await initDatabase();

        // 조직은 3개까지, 한국은 국가를 붙이지 않는다.
        expect(ipInfoOf("1.2")).toMatchObject({label: "가, 나, 다 외 1", category: "korea"});
        // VPN이 국가보다 앞선다.
        expect(ipInfoOf("3.4")).toMatchObject({label: "X (VPN)", category: "vpn"});
        expect(ipInfoOf("5.6")).toMatchObject({label: "중국", category: "china"});
        expect(ipInfoOf("9.9")).toBeUndefined();

        // 갱차 목록은 처음 물을 때 읽기 시작한다. 두 이유에 든 uid는 이유를 잇는다.
        expect(banReasonsOf("u1")).toBeUndefined();
        await vi.waitFor(() => expect(banReasonsOf("u1")).toBe("도배, 광고"));
        expect(banReasonsOf("u2")).toBe("광고");
        expect(banReasonsOf("u3")).toBeUndefined();
    });
});
