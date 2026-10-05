import {describe, expect, it} from "vitest";

import {candidateKey, type CompactIpData, createIpLookup, encodeIpData, type IpCandidate, parseIpData} from "@/core/ipdb";

const slot = (a: number, b: number): number => a * 256 + b;

const KT: IpCandidate = {org: "KT", vpn: false};
const SOFTBANK: IpCandidate = {org: "SoftBank", country: "일본", vpn: false};
const VPN: IpCandidate = {org: "Tencent", country: "중국", vpn: true};
const FOREIGN: IpCandidate = {country: "미국", vpn: false};

/** 구간 시작과 값으로 runs를 만든다. */
const runs = (starts: number[], values: number[]): string => new Uint8Array(Uint16Array.from([...starts, ...values]).buffer).toBase64();

const data = (fields: Partial<CompactIpData>): CompactIpData => ({runs: runs([0], [0]), orgs: [""], countries: [""], meta: [], lists: [], ...fields});

describe("encodeIpData / createIpLookup", () => {
    it("대역별 후보를 저장했다가 그대로 되돌린다", () => {
        const lookup = createIpLookup(encodeIpData(new Map([
            [slot(1, 2), [KT]],
            [slot(1, 3), [SOFTBANK, VPN]],
            [slot(255, 255), [FOREIGN]]
        ])));

        expect(lookup("1.2.3.4")).toEqual([{org: "KT", country: undefined, vpn: false}]);
        expect(lookup("1.3")).toEqual([
            {org: "SoftBank", country: "일본", vpn: false},
            {org: "Tencent", country: "중국", vpn: true}
        ]);
        expect(lookup("255.255.0.1")).toEqual([{org: undefined, country: "미국", vpn: false}]);
    });

    it("정보가 없는 대역과 잘못된 IP는 undefined다", () => {
        const lookup = createIpLookup(encodeIpData(new Map([[slot(1, 2), [KT]], [slot(1, 4), []]])));
        for (const ip of ["1.1", "1.4", "0.0", "256.2", "1", "-1.2", "abc", ""]) expect(lookup(ip)).toBeUndefined();
    });

    it("같은 후보 목록은 한 번만 담는다", () => {
        const encoded = encodeIpData(new Map([[slot(1, 1), [KT, SOFTBANK]], [slot(2, 2), [KT, SOFTBANK]], [slot(3, 3), [SOFTBANK, KT]]]));
        expect(encoded.lists).toHaveLength(2);
    });

    it("자주 나오는 후보가 앞 번호를 받는다", () => {
        const encoded = encodeIpData(new Map([[slot(1, 1), [SOFTBANK]], [slot(2, 2), [KT]], [slot(3, 3), [KT]]]));
        expect(encoded.orgs[encoded.meta[0]!]).toBe("KT");
    });

    it("같은 조직·국가 이름은 표에 한 번만 담는다", () => {
        const encoded = encodeIpData(new Map([[slot(1, 1), [KT]], [slot(1, 2), [{org: "KT", vpn: true}]], [slot(1, 3), [{org: "KT", country: "미국", vpn: false}]]]));
        expect(encoded.orgs).toEqual(["KT"]);
        expect(encoded.countries).toEqual(["", "미국"]);
    });

    it("이웃한 같은 값은 한 구간으로 줄인다", () => {
        const prefixes = new Map(Array.from({length: 256}, (_, b) => [slot(9, b), [KT]]));
        const {runs: encoded} = encodeIpData(prefixes);
        // 0 구간, KT 구간, 0 구간 → 시작 3개 + 값 3개.
        expect(Uint8Array.fromBase64(encoded).length).toBe(6 * 2);
    });

    it("넣는 순서가 같으면 결과도 같다", () => {
        const prefixes = (): Map<number, IpCandidate[]> => new Map([[slot(1, 1), [KT]], [slot(1, 2), [VPN, KT]]]);
        expect(JSON.stringify(encodeIpData(prefixes()))).toBe(JSON.stringify(encodeIpData(prefixes())));
    });
});

describe("createIpLookup 검사", () => {
    it("시작점과 값의 짝이 맞지 않으면 던진다", () => {
        const odd = new Uint8Array(Uint16Array.from([0, 1, 1]).buffer).toBase64();
        expect(() => createIpLookup(data({runs: odd, meta: [0, 0, 0]}))).toThrow("IP 데이터 형식");
    });

    it("구간 시작이 늘지 않으면 던진다", () => {
        expect(() => createIpLookup(data({runs: runs([0, 5, 5], [0, 1, 0]), meta: [0, 0, 0]}))).toThrow("IP 데이터 형식");
        expect(() => createIpLookup(data({runs: runs([0, 5, 3], [0, 1, 0]), meta: [0, 0, 0]}))).toThrow("IP 데이터 형식");
    });

    it("값이 후보 범위를 넘으면 던진다", () => {
        expect(() => createIpLookup(data({runs: runs([0, 5], [0, 2]), meta: [0, 0, 0]}))).toThrow("IP 데이터 형식");
        expect(createIpLookup(data({runs: runs([0, 5], [0, 2]), meta: [0, 0, 0], lists: [[0]]}))("0.5")).toEqual([{org: undefined, country: undefined, vpn: false}]);
    });

    it("마지막 구간은 표 끝까지 이어진다", () => {
        const lookup = createIpLookup(data({runs: runs([0, slot(200, 0)], [0, 1]), orgs: ["", "KT"], meta: [1, 0, 0]}));
        expect(lookup("199.255")).toBeUndefined();
        expect(lookup("200.0")?.[0]?.org).toBe("KT");
        expect(lookup("255.255")?.[0]?.org).toBe("KT");
    });
});

describe("parseIpData", () => {
    const valid = encodeIpData(new Map([[slot(1, 2), [KT]]]));

    it("저장 형식을 그대로 돌려준다", () => {
        const text = JSON.stringify({...valid, version: "2026-01-01 00:00"});
        expect(parseIpData(text)).toEqual(JSON.parse(text));
    });

    it("빈 문자열과 옛 형식은 null이다", () => {
        expect(parseIpData("")).toBeNull();
        expect(parseIpData(JSON.stringify({"1.2": {org: "KT"}}))).toBeNull();
        expect(parseIpData("[]")).toBeNull();
    });

    it("깨진 JSON은 던진다", () => {
        expect(() => parseIpData("{")).toThrow(SyntaxError);
    });

    it.each([
        ["version이 문자열이 아님", {version: 1}],
        ["runs가 문자열이 아님", {runs: []}],
        ["orgs에 문자열이 아닌 값", {orgs: [1]}],
        ["meta 길이가 3의 배수가 아님", {meta: [0, 0]}],
        ["meta의 조직 번호가 범위 밖", {meta: [5, 0, 0]}],
        ["meta의 국가 번호가 범위 밖", {meta: [0, 5, 0]}],
        ["meta 번호가 정수가 아님", {meta: [0.5, 0, 0]}],
        ["lists 번호가 범위 밖", {lists: [[0, 9]]}],
        ["lists가 배열의 배열이 아님", {lists: [1]}]
    ])("모양이 틀리면 null이다: %s", (_, fields) => {
        expect(parseIpData(JSON.stringify({...valid, ...fields}))).toBeNull();
    });
});

describe("candidateKey", () => {
    it("조직·국가·VPN이 모두 같아야 같은 키다", () => {
        expect(candidateKey({org: "KT", vpn: false})).toBe(candidateKey({org: "KT", country: undefined, vpn: false}));
        expect(candidateKey(KT)).not.toBe(candidateKey({...KT, vpn: true}));
        expect(candidateKey({org: "a", vpn: false})).not.toBe(candidateKey({country: "a", vpn: false}));
    });
});
