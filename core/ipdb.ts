/**
 * IP 대역(a.b) → 후보(조직명·국가·VPN) 데이터.
 *
 * 서버 형식(RawIpData): meta[] + b{"a.b": meta 번호[]}  — 사람이 읽을 수 있는 JSON
 * 저장 형식(CompactIpData): 65536칸 Uint16 표(base64) + 조직/국가 표 — 페이지마다 문자열 하나만 읽고 배열 한 칸으로 조회한다
 */

export interface RawIpData {
    /** o: 조직명, c: 국가(없으면 한국), v: VPN이면 1 */
    meta: { o?: string; c?: string; v?: number }[];
    /** "a.b" → 가능성 있는 meta 번호들 (앞일수록 유력) */
    b: Record<string, number[]>;
}

export interface CompactIpData {
    /** base64(Uint16Array[65536]) — 칸 번호 a*256+b, 값 0=정보 없음, 그 외 (값-1)이 meta 번호 또는 meta 개수+목록 번호 */
    table: string;
    orgs: string[];
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

/** 서버 형식 → 저장 형식 */
export const compactIpData = (raw: RawIpData): CompactIpData => {
    // 서버에서 온 값 — 예전 형식(대역→이름 객체)이나 깨진 응답이면 여기서 끊는다
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

    return {table: new Uint8Array(table.buffer).toBase64(), orgs, countries, meta, lists};
};

/** 저장 형식 → 조회 함수 (표는 한 번만 디코드) */
export const createIpLookup = (data: CompactIpData): ((ip: string) => IpCandidate[] | undefined) => {
    const table = new Uint16Array(Uint8Array.fromBase64(data.table).buffer);
    const metaCount = data.meta.length / 3;

    const candidate = (index: number): IpCandidate => ({
        org: data.orgs[data.meta[index * 3]!] || undefined,
        country: data.countries[data.meta[index * 3 + 1]!] || undefined,
        vpn: data.meta[index * 3 + 2] === 1
    });

    return (ip) => {
        const slot = prefixIndex(ip);
        const value = slot === undefined ? 0 : table[slot]!;
        if (!value) return undefined;

        const indexes = value - 1 < metaCount ? [value - 1] : data.lists[value - 1 - metaCount] ?? [];
        return indexes.map(candidate);
    };
};
