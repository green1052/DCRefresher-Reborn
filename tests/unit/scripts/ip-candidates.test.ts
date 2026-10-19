// @vitest-environment node
import {describe, expect, it} from "vitest";

import {type Asn, buildCandidates, normalizeBans, type Range} from "@/scripts/ip-candidates";

const asn = (start: number, end: number, number: number, org: string): Range<Asn> => ({start, end, value: {asn: number, org}});
const country = (start: number, end: number, iso: string): Range<string> => ({start, end, value: iso});

describe("buildCandidates", () => {
    it("/16 경계에 걸친 구간을 대역마다 나눈다", () => {
        const candidates = buildCandidates([asn(0, 131_071, 1, "Org")], [country(0, 131_071, "KR")], [], new Map());

        expect([...candidates]).toEqual([
            [0, [{org: "Org", vpn: false}]],
            [1, [{org: "Org", vpn: false}]]
        ]);
    });

    it("대역의 1% 미만인 후보는 빼되 가장 큰 후보는 남긴다", () => {
        const candidates = buildCandidates(
            [asn(0, 64_999, 1, "Big"), asn(65_000, 65_535, 2, "Small"), asn(65_536, 65_635, 3, "Only")],
            [country(0, 131_071, "KR")],
            [],
            new Map()
        );

        expect(candidates.get(0)).toEqual([{org: "Big", vpn: false}]);
        expect(candidates.get(1)).toEqual([{org: "Only", vpn: false}]);
    });

    it("한국은 KISA 이름을, 해외는 국가를 쓰고 국가를 모르면 VPN만 남긴다", () => {
        const candidates = buildCandidates(
            [asn(0, 65_535, 1, "KT Corp"), asn(65_536, 131_071, 2, "NTT"), asn(131_072, 196_607, 3, "AWS"), asn(196_608, 327_679, 4, "Unknown")],
            [country(0, 65_535, "KR"), country(65_536, 131_071, "JP"), country(131_072, 196_607, "US")],
            [{start: 262_144, end: 327_679, value: true}],
            new Map([[1, "KT"]])
        );

        expect(candidates.get(0)).toEqual([{org: "KT", vpn: false}]);
        expect(candidates.get(1)).toEqual([{org: "NTT", country: "일본", vpn: false}]);
        expect(candidates.get(2)).toEqual([{country: "미국", vpn: false}]);
        expect(candidates.has(3)).toBe(false);
        expect(candidates.get(4)).toEqual([{org: "Unknown", vpn: true}]);
    });
});

describe("normalizeBans", () => {
    it("아이디의 공백·빈 값·중복을 빼고 갤러리와 아이디를 정렬한다", () => {
        expect(normalizeBans({b: [" y ", "x", "y", ""], a: []})).toEqual({a: [], b: ["x", "y"]});
    });

    it("형식이 틀리면 멈춘다", () => {
        expect(() => normalizeBans([])).toThrow();
        expect(() => normalizeBans({a: [1]})).toThrow();
    });
});
