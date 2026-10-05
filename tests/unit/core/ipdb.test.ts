import {describe, expect, it} from "vitest";

import {createIpLookup, encodeIpData, type CompactIpData, type IpCandidate, parseIpData} from "@/core/ipdb";

const kt: IpCandidate = {org: "KT", vpn: false};
const softbank: IpCandidate = {org: "SoftBank", country: "일본", vpn: false};
const vpn: IpCandidate = {org: "Tencent", country: "중국", vpn: true};
const unknownCountry: IpCandidate = {country: "미국", vpn: false};

const prefixes = new Map<number, IpCandidate[]>([
    [1 * 256 + 2, [kt]],
    [1 * 256 + 3, [kt]],
    [10 * 256 + 0, [softbank, vpn]],
    [10 * 256 + 1, [softbank, vpn]],
    [255 * 256 + 255, [unknownCountry]]
]);

describe("encodeIpData / createIpLookup", () => {
    it("대역별 후보를 저장 형식으로 만들고 그대로 되돌린다", () => {
        const data = encodeIpData(prefixes);
        // 이웃 대역이 같으면 구간 하나로 줄어든다: [0-257 없음][258-259 KT][260-2559 없음][2560-2561 목록][2562-65534 없음][65535]
        expect(new Uint16Array(Uint8Array.fromBase64(data.runs).buffer).length / 2).toBe(6);
        expect(data.lists).toEqual([[1, 2]]);

        const lookup = createIpLookup(JSON.parse(JSON.stringify(data)) as typeof data);
        expect(lookup("1.2")).toEqual([kt]);
        expect(lookup("1.3.4.5")).toEqual([kt]);
        expect(lookup("1.4")).toBeUndefined();
        expect(lookup("10.1")).toEqual([softbank, vpn]);
        expect(lookup("255.255")).toEqual([{org: undefined, country: "미국", vpn: false}]);
        expect(lookup("256.1")).toBeUndefined();
        expect(lookup("abc")).toBeUndefined();
        expect(lookup("")).toBeUndefined();
    });

    it("자주 나오는 후보가 앞 번호를 받는다", () => {
        const data = encodeIpData(prefixes);
        expect(data.orgs[0]).toBe("KT");
        expect(data.meta.slice(0, 3)).toEqual([0, 0, 0]);
    });

    it("구간 시작이 늘지 않거나 값이 범위 밖이면 조용히 펼치지 않고 띤다", () => {
        const data = encodeIpData(prefixes);
        const runs = new Uint16Array(Uint8Array.fromBase64(data.runs).buffer);
        const count = runs.length / 2;
        const withRuns = (patched: Uint16Array): CompactIpData => ({...data, runs: new Uint8Array(patched.buffer).toBase64()});

        // 시작이 뒤로 물러난 구간.
        const backwards = Uint16Array.from(runs);
        [backwards[0], backwards[1]] = [backwards[1]!, backwards[0]!];
        expect(() => createIpLookup(withRuns(backwards))).toThrow();

        // meta+lists 범위 밖의 값.
        const outOfRange = Uint16Array.from(runs);
        outOfRange[count] = data.meta.length / 3 + data.lists.length + 1;
        expect(() => createIpLookup(withRuns(outOfRange))).toThrow();
    });
});

describe("parseIpData", () => {
    it("빈 문자열과 옛 형식은 null, 깨진 JSON은 던진다", () => {
        expect(parseIpData("")).toBeNull();
        expect(parseIpData(JSON.stringify({version: "1", prefixes: {}}))).toBeNull();
        expect(parseIpData(JSON.stringify({...encodeIpData(prefixes), meta: ["x"]}))).toBeNull();
        expect(() => parseIpData("{")).toThrow();
        expect(parseIpData(JSON.stringify(encodeIpData(prefixes)))).not.toBeNull();
        // 번호가 어긋나면 다른 기관·국가가 조용히 보이므로 받지 않는다.
        const data = encodeIpData(prefixes);
        expect(parseIpData(JSON.stringify({...data, meta: data.meta.slice(0, -1)}))).toBeNull();
        expect(parseIpData(JSON.stringify({...data, meta: [data.orgs.length, 0, 0, ...data.meta.slice(3)]}))).toBeNull();
        expect(parseIpData(JSON.stringify({...data, lists: [[data.meta.length / 3]]}))).toBeNull();
    });
});
