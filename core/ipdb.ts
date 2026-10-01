/**
 * IP 대역(a.b) → 후보(조직명·국가·VPN) 데이터.
 * 저장 형식(CompactIpData)은 DB 워크플로(scripts/build-db.ts)가 encodeIpData로 만들어 data 브랜치 ip.json으로 올리고,
 * 확장은 받은 문자열을 그대로 저장해 createIpLookup으로 읽는다. 쓰는 쪽과 읽는 쪽을 한 파일에 둔다.
 */

import {isRecord} from "@/utils/record";

/** 저장 형식 버전. DB 메타(meta.format)에 적어 두고, 확장 업데이트로 바뀌면 같은 DB 버전이어도 다시 받는다 (core/database.ts). 파일에는 넣지 않는다 (모양으로 검사한다) */
export const IP_FORMAT = 2;

export interface CompactIpData {
    /** 만든 시각 (UTC, 분까지. data 브랜치 version 파일과 같다). 두 파일은 CDN에 따로 캐시되므로 저장할 버전은 이것을 쓴다 */
    version?: string;
    /**
     * 65536칸 표(칸 번호 a*256+b)를 값이 같은 구간으로 줄인 것. base64(Uint16Array[구간 시작 × n, 값 × n]).
     * 이웃 대역은 대개 같은 기관이라 구간이 칸 수의 절반도 안 된다. 값 0은 정보 없음,
     * 그 밖에는 값-1이 meta 개수보다 작으면 meta 번호, 아니면 meta 개수 + lists 번호다.
     */
    runs: string;
    /** 조직명. ""는 조직 없음 (국가만 아는 해외 대역 등) */
    orgs: string[];
    /** 국가명. ""는 한국 (배지에서 국가를 생략한다) */
    countries: string[];
    /** [조직 번호, 국가 번호, VPN(0|1)] × meta 개수 */
    meta: number[];
    /** 후보가 여럿인 대역의 meta 번호 목록 (같은 목록은 한 번만) */
    lists: number[][];
}

export interface IpCandidate {
    org?: string;
    /** 없으면 한국 */
    country?: string;
    vpn: boolean;
}

const prefixIndex = (ip: string): number | undefined => {
    const [a, b] = ip.split(".").map(Number);
    return a !== undefined && b !== undefined && a >= 0 && a < 256 && b >= 0 && b < 256 ? a * 256 + b : undefined;
};

const candidateKey = ({org, country, vpn}: IpCandidate): string => `${org ?? ""}\u0000${country ?? ""}\u0000${vpn ? 1 : 0}`;

/**
 * 대역(a*256+b) → 후보들(유력한 순) → 저장 형식. 대역 순으로 넘기면 결과가 늘 같다.
 * 자주 나오는 후보가 앞 번호를 받게 해 meta·lists의 JSON을 줄인다.
 */
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

    const orgs: string[] = [];
    const countries: string[] = [];
    const indexIn = (table: string[], value: string): number => {
        const found = table.indexOf(value);
        return found >= 0 ? found : table.push(value) - 1;
    };
    const meta = ordered.flatMap((candidate) => [indexIn(orgs, candidate.org ?? ""), indexIn(countries, candidate.country ?? ""), candidate.vpn ? 1 : 0]);

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

/** 저장된(받은) 문자열 → 저장 형식. 비었거나 옛 형식이면 null (옛 형식은 다음 갱신이 새로 받는다). JSON이 깨졌으면 던진다 */
export const parseIpData = (text: string): CompactIpData | null => {
    if (!text) return null;
    const data: unknown = JSON.parse(text);
    return isCompactIpData(data) ? data : null;
};

/** 모양까지 본다. 받은 파일은 그대로 저장되고 페이지마다 읽히므로, 필드 하나만 틀려도 배지·미리보기가 깨진다 */
const isCompactIpData = (data: unknown): data is CompactIpData =>
    isRecord(data) && typeof data.runs === "string" &&
    (data.version === undefined || typeof data.version === "string") &&
    isStrings(data.orgs) && isStrings(data.countries) && isNumbers(data.meta) &&
    Array.isArray(data.lists) && data.lists.every(isNumbers);

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isNumbers = (value: unknown): value is number[] => Array.isArray(value) && value.every((item) => typeof item === "number");

/** 저장 형식 → 조회 함수. 구간을 65536칸 표로 한 번 펼쳐 조회는 배열 한 칸으로 한다 */
export const createIpLookup = (data: CompactIpData): ((ip: string) => IpCandidate[] | undefined) => {
    const runs = new Uint16Array(Uint8Array.fromBase64(data.runs).buffer);
    // 시작점과 값이 짝을 이뤄야 한다. 홀수면 값 칸이 어긋나 표가 0으로 조용히 채워진다
    if (runs.length % 2 !== 0) throw new Error("IP 데이터 형식이 올바르지 않습니다.");
    const count = runs.length / 2;
    const table = new Uint16Array(65536);
    for (let run = 0; run < count; run++) table.fill(runs[count + run]!, runs[run]!, run + 1 < count ? runs[run + 1]! : 65536);

    // 조회에 쓰는 필드만 클로저에 남긴다. data를 통째로 잡으면 이미 디코드한 base64 문자열이 탭마다 남는다
    const {orgs, countries, meta, lists} = data;
    const metaCount = meta.length / 3;

    const candidate = (index: number): IpCandidate => ({
        org: orgs[meta[index * 3]!] || undefined,
        country: countries[meta[index * 3 + 1]!] || undefined,
        vpn: meta[index * 3 + 2] === 1
    });

    return (ip) => {
        const slot = prefixIndex(ip);
        const value = slot === undefined ? 0 : table[slot]!;
        if (!value) return undefined;

        const indexes = value - 1 < metaCount ? [value - 1] : lists[value - 1 - metaCount] ?? [];
        return indexes.map(candidate);
    };
};
