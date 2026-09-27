/**
 * IP 대역(a.b) → 후보(조직명·국가·VPN) 데이터.
 *
 * 원본 형식(RawIpData): meta[] + b{"a.b": meta 번호[]}. DB 워크플로(scripts/build-db.ts)가 계산하는 중간 형식이다.
 * 저장 형식(CompactIpData): 표를 구간으로 줄인 것과 조직/국가 표. 워크플로가 data 브랜치 ip.json으로 올리고, 확장은 받은 그대로 저장한다.
 */

export interface RawIpData {
    /** o: 조직명, c: 국가(없으면 한국), v: VPN이면 1 */
    meta: { o?: string; c?: string; v?: number }[];
    /** "a.b" → 가능성 있는 meta 번호들 (앞일수록 유력) */
    b: Record<string, number[]>;
}

/** 저장 형식 버전. 바꾸면 확장이 같은 DB 버전이어도 다시 받는다 (core/database.ts) */
export const IP_FORMAT = 2;

export interface CompactIpData {
    v: typeof IP_FORMAT;
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

/** 원본 형식 → 저장 형식 (DB 워크플로) */
export const compactIpData = (raw: RawIpData): CompactIpData => {
    if (!Array.isArray(raw?.meta) || !raw.b || typeof raw.b !== "object") throw new Error("IP 데이터 형식이 올바르지 않습니다.");

    const orgs: string[] = [];
    const countries: string[] = [];
    const indexIn = (table: string[], value: string): number => {
        const found = table.indexOf(value);
        return found >= 0 ? found : table.push(value) - 1;
    };

    const meta = raw.meta.flatMap((entry) => [indexIn(orgs, entry.o ?? ""), indexIn(countries, entry.c ?? ""), entry.v ? 1 : 0]);

    const lists: number[][] = [];
    const listIds = new Map<string, number>();
    const table = new Uint16Array(65536);

    for (const [prefix, candidates] of Object.entries(raw.b)) {
        const slot = prefixIndex(prefix);
        if (slot === undefined || candidates.length === 0) continue;

        let value = candidates[0]!;
        if (candidates.length > 1) {
            const key = candidates.join(",");
            let id = listIds.get(key);
            if (id === undefined) {
                id = lists.push(candidates) - 1;
                listIds.set(key, id);
            }
            value = raw.meta.length + id;
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

    return {v: IP_FORMAT, runs: new Uint8Array(Uint16Array.from([...starts, ...values]).buffer).toBase64(), orgs, countries, meta, lists};
};

/** 저장된(받은) 문자열 → 저장 형식. 비었거나 옛 형식이면 null (옛 형식은 다음 갱신이 새로 받는다). JSON이 깨졌으면 던진다 */
export const parseIpData = (text: string): CompactIpData | null => {
    if (!text) return null;
    const data = JSON.parse(text) as Partial<CompactIpData> | null;
    return data?.v === IP_FORMAT ? (data as CompactIpData) : null;
};

/** 저장 형식 → 조회 함수. 구간을 65536칸 표로 한 번 펼쳐 조회는 배열 한 칸으로 한다 */
export const createIpLookup = (data: CompactIpData): ((ip: string) => IpCandidate[] | undefined) => {
    const runs = new Uint16Array(Uint8Array.fromBase64(data.runs).buffer);
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
