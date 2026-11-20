/** IP 대역(a.b) → 후보 데이터. 인코더와 디코더를 한 파일에 둔다. */

import {isRecord} from "@/utils/record";

/** 저장 형식 버전. 메타에 두고 바뀌면 같은 DB 버전이어도 다시 받는다. */
export const IP_FORMAT = 2;

export interface CompactIpData {
    /** 만든 시각. version 파일과 따로 캐시되어 저장 버전은 이것을 쓴다. */
    version?: string;
    /** 65536칸 표를 같은 값 구간으로 줄인 base64. 값-1이 meta 수 미만이면 meta 번호, 아니면 meta 수+lists 번호. */
    runs: string;
    /** 조직명. ""는 조직 없음 (국가만 아는 해외 대역 등). */
    orgs: string[];
    /** 국가명. ""는 한국 (배지에서 국가를 생략한다). */
    countries: string[];
    /** [조직 번호, 국가 번호, VPN(0|1)] × meta 개수. */
    meta: number[];
    /** 후보가 여럿인 대역의 meta 번호 목록 (같은 목록은 한 번만). */
    lists: number[][];
}

export interface IpCandidate {
    org?: string;
    /** 없으면 한국. */
    country?: string;
    vpn: boolean;
}

const prefixIndex = (ip: string): number | undefined => {
    const [a, b] = ip.split(".").map(Number);
    return a !== undefined && b !== undefined && a >= 0 && a < 256 && b >= 0 && b < 256 ? a * 256 + b : undefined;
};

/** 후보를 같은지 견주는 키. */
export const candidateKey = ({org, country, vpn}: IpCandidate): string => `${org ?? ""}\u0000${country ?? ""}\u0000${vpn ? 1 : 0}`;

/** 대역 → 후보들 → 저장 형식. 자주 나오는 후보에 앞 번호를 줘 JSON을 줄인다. */
export const encodeIpData = (prefixes: ReadonlyMap<number, readonly IpCandidate[]>): CompactIpData => {
    const frequency = new Map<string, { candidate: IpCandidate; count: number }>();
    for (const candidates of prefixes.values()) {
        for (const candidate of candidates) {
            const entry = frequency.get(candidateKey(candidate));
            if (entry) entry.count++;
            else frequency.set(candidateKey(candidate), {candidate, count: 1});
        }
    }
    const ordered = [...frequency.values()].sort((a, b) => b.count - a.count).map(({candidate}) => candidate);
    const metaIndex = new Map(ordered.map((candidate, index) => [candidateKey(candidate), index]));

    // Map이 삽입 순서를 지키므로 키 목록이 곧 번호 표다.
    const orgIndex = new Map<string, number>();
    const countryIndex = new Map<string, number>();
    const indexIn = (index: Map<string, number>, value: string): number => {
        let found = index.get(value);
        if (found === undefined) index.set(value, (found = index.size));
        return found;
    };
    const meta = ordered.flatMap((candidate) => [indexIn(orgIndex, candidate.org ?? ""), indexIn(countryIndex, candidate.country ?? ""), candidate.vpn ? 1 : 0]);
    const orgs = [...orgIndex.keys()];
    const countries = [...countryIndex.keys()];

    const lists: number[][] = [];
    const listIds = new Map<string, number>();
    const table = new Uint16Array(65536);

    for (const [slot, candidates] of prefixes) {
        const indexes = candidates.map((candidate) => metaIndex.get(candidateKey(candidate))!);
        if (indexes.length === 0) continue;

        let value = indexes[0]!;
        if (indexes.length > 1) {
            const key = indexes.join(",");
            let id = listIds.get(key);
            if (id === undefined) {
                id = lists.push(indexes) - 1;
                listIds.set(key, id);
            }
            value = ordered.length + id;
        }

        if (value + 1 > 0xffff) throw new Error("IP 데이터가 Uint16 표 범위를 넘습니다.");
        table[slot] = value + 1;
    }

    const starts: number[] = [];
    const values: number[] = [];
    for (const [slot, value] of table.entries()) {
        if (slot === 0 || value !== table[slot - 1]) {
            starts.push(slot);
            values.push(value);
        }
    }

    return {runs: new Uint8Array(Uint16Array.from([...starts, ...values]).buffer).toBase64(), orgs, countries, meta, lists};
};

/** 받은 문자열 → 저장 형식. 비었거나 옛 형식이면 null. */
export const parseIpData = (text: string): CompactIpData | null => {
    if (!text) return null;
    const data: unknown = JSON.parse(text);
    return isCompactIpData(data) ? data : null;
};

/** 배경이 검사한 문자열 → 저장 형식. 페이지마다 다시 검사하지 않는다. */
export const parseStoredIpData = (text: string): CompactIpData => JSON.parse(text);

/** 번호가 벗어나면 다른 기관이 조용히 보이므로 meta, lists 번호 범위까지 본다. */
const isCompactIpData = (data: unknown): data is CompactIpData => {
    if (!isRecord(data) || typeof data.runs !== "string" || (data.version !== undefined && typeof data.version !== "string")) return false;
    const {orgs, countries, meta, lists} = data;
    if (!isStrings(orgs) || !isStrings(countries) || !isNumbers(meta) || meta.length % 3 !== 0) return false;
    if (!Array.isArray(lists) || !lists.every(isNumbers)) return false;

    const metaCount = meta.length / 3;
    const inRange = (value: number, size: number): boolean => Number.isInteger(value) && value >= 0 && value < size;
    for (let index = 0; index < metaCount; index++) {
        if (!inRange(meta[index * 3]!, orgs.length) || !inRange(meta[index * 3 + 1]!, countries.length)) return false;
    }
    return lists.every((list) => list.every((value) => inRange(value, metaCount)));
};

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isNumbers = (value: unknown): value is number[] => Array.isArray(value) && value.every((item) => typeof item === "number");

/** 저장 형식 → 조회 함수. 구간을 65536칸 표로 한 번 펼쳐 조회는 배열 한 칸으로 한다. */
export const createIpLookup = (data: CompactIpData): ((ip: string) => IpCandidate[] | undefined) => {
    const runs = new Uint16Array(Uint8Array.fromBase64(data.runs).buffer);
    // 시작점과 값이 짝을 이뤄야 한다. 홀수면 값 칸이 어긋나 표가 0으로 조용히 채워진다.
    if (runs.length % 2 !== 0) throw new Error("IP 데이터 형식이 올바르지 않습니다.");
    const count = runs.length / 2;

    // 시작점이나 값이 어긋나면 조용히 잘못 보이므로 여기서 던진다.
    const total = data.meta.length / 3 + data.lists.length;
    for (let run = 0; run < count; run++) {
        if ((run > 0 && runs[run]! <= runs[run - 1]!) || runs[count + run]! - 1 >= total) throw new Error("IP 데이터 형식이 올바르지 않습니다.");
    }

    const table = new Uint16Array(65536);
    for (let run = 0; run < count; run++) table.fill(runs[count + run]!, runs[run]!, run + 1 < count ? runs[run + 1]! : 65536);

    // 조회에 쓰는 필드만 남긴다. data를 통째로 잡으면 base64 문자열과 JS 배열이 탭마다 남는다.
    const {orgs, countries} = data;
    const meta = Uint16Array.from(data.meta);
    const metaCount = meta.length / 3;
    // 목록 i는 listFlat[listStart[i] .. listStart[i + 1]) 이다.
    const listStart = new Uint32Array(data.lists.length + 1);
    for (const [index, list] of data.lists.entries()) listStart[index + 1] = listStart[index]! + list.length;
    const listFlat = new Uint16Array(listStart[data.lists.length]!);
    for (const [index, list] of data.lists.entries()) listFlat.set(list, listStart[index]);

    const candidate = (index: number): IpCandidate => ({
        org: orgs[meta[index * 3]!] || undefined,
        country: countries[meta[index * 3 + 1]!] || undefined,
        vpn: meta[index * 3 + 2] === 1
    });

    return (ip) => {
        const slot = prefixIndex(ip);
        const value = slot === undefined ? 0 : table[slot]!;
        if (!value) return undefined;

        if (value - 1 < metaCount) return [candidate(value - 1)];
        const list = value - 1 - metaCount;
        return Array.from(listFlat.subarray(listStart[list], listStart[list + 1]), candidate);
    };
};
