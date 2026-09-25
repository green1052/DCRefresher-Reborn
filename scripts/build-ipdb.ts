/**
 * IP DB 생성: bun scripts/build-ipdb.ts <MaxMind CSV 폴더> <출력 폴더>
 *
 * 입력
 * - MaxMind GeoLite2 CSV 3개 (GeoLite2-ASN-Blocks-IPv4.csv, GeoLite2-Country-Blocks-IPv4.csv, GeoLite2-Country-Locations-en.csv)
 * - VPN 대역 목록, KISA 국내 AS 목록 — 여기서 직접 받는다
 *
 * 출력: ip.json (RawIpData), version
 *
 * 디시는 IP를 a.b까지만 보여주므로 /16 단위로 모은다. 한 /16 안의 후보는 차지하는 주소 수가 많은 순(앞일수록 유력).
 * - 한국: KISA 한글 기관명을 축약(ipdb-names.ts, 없으면 MaxMind 영문명), 국가 생략
 * - 일본·중국: 영문 기관명 + 국가
 * - 그 외: 국가만 (VPN이면 기관명도)
 * - VPN 목록과 겹치는 부분은 따로 떼어 v: 1
 * - /16의 1% 미만인 후보는 버리고 최대 MAX_CANDIDATES개
 */
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";

import {compactIpData, createIpLookup, type RawIpData} from "../core/ipdb";

import {shortenOrg} from "./ipdb-names";

const VPN_URL = "https://raw.githubusercontent.com/X4BNet/lists_vpn/refs/heads/main/ipv4.txt";
const KISA_URL = "https://xn--3e0bx5euxnjje69i70af08bea817g.xn--3e0b707e/jsp/business/management/asList.jsp";

/** Intl 이름이 길거나 국내에서 덜 쓰는 표기인 것만 */
const COUNTRY_NAME_OVERRIDES: Record<string, string> = {HK: "홍콩", MO: "마카오", AU: "호주"};

const MAX_CANDIDATES = 8;
const MIN_SHARE = 65536 / 100;

const [csvDir, outDir] = process.argv.slice(2);
if (!csvDir || !outDir) throw new Error("사용법: bun scripts/build-ipdb.ts <MaxMind CSV 폴더> <출력 폴더>");

type Range<T> = { start: number; end: number; value: T };

const ipToInt = (ip: string): number => ip.split(".").reduce((acc, octet) => acc * 256 + Number(octet), 0);

const parseCidr = (cidr: string): { start: number; end: number } | undefined => {
    const [ip, bits] = cidr.trim().split("/");
    if (!ip || !bits || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return undefined;
    const size = 2 ** (32 - Number(bits));
    const start = ipToInt(ip) - (ipToInt(ip) % size);
    return {start, end: start + size - 1};
};

const csvRows = async (name: string): Promise<string[]> =>
    (await readFile(join(csvDir, name), "utf8")).split("\n").slice(1).filter(Boolean);

const fetchText = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.text();
};

// ===== 입력 =====

const regionName = new Intl.DisplayNames(["ko"], {type: "region"});
/** geoname_id → ISO 코드 */
const isoOf = new Map<string, string>();
for (const row of await csvRows("GeoLite2-Country-Locations-en.csv")) {
    const [id, , , , iso] = row.split(",");
    if (id && iso) isoOf.set(id, iso);
}

const countries: Range<string>[] = [];
for (const row of await csvRows("GeoLite2-Country-Blocks-IPv4.csv")) {
    const [network, geoname, registered] = row.split(",");
    const iso = isoOf.get(geoname || registered || "");
    const range = parseCidr(network ?? "");
    if (iso && range) countries.push({...range, value: iso});
}

const asns: Range<{ asn: number; org: string }>[] = [];
for (const row of await csvRows("GeoLite2-ASN-Blocks-IPv4.csv")) {
    // 기관명에만 쉼표/따옴표가 들어간다
    const [network, asn, ...org] = row.split(",");
    const range = parseCidr(network ?? "");
    if (range) asns.push({...range, value: {asn: Number(asn), org: org.join(",").trim().replace(/^"|"$/g, "").replace(/""/g, "\"")}});
}

const vpns: Range<true>[] = [];
for (const line of (await fetchText(VPN_URL)).split("\n")) {
    const range = parseCidr(line);
    if (range) vpns.push({...range, value: true});
}

/** AS 번호 → KISA 한글 기관명 */
const kisa = new Map<number, string>();
for (const [, org, asn] of (await fetchText(KISA_URL)).matchAll(/<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>AS(\d+)<\/td>/g)) {
    kisa.set(Number(asn), shortenOrg(org!.trim()));
}

if (asns.length < 100_000 || countries.length < 100_000) throw new Error("MaxMind CSV가 너무 작습니다.");
if (vpns.length < 10_000) throw new Error(`VPN 목록이 너무 작습니다: ${vpns.length}`);
if (kisa.size < 500) throw new Error(`KISA 목록을 읽지 못했습니다: ${kisa.size}`);

// ===== /16마다 후보별 주소 수 =====

type Meta = RawIpData["meta"][number];

const metaOf = (asn: { asn: number; org: string } | undefined, iso: string | undefined, vpn: boolean): Meta | undefined => {
    const v = vpn ? 1 : undefined;
    if (iso === "KR") return {o: kisa.get(asn?.asn ?? 0) ?? asn?.org, v};
    // 국가를 모르면 한국으로 보이므로 VPN일 때만 기관명으로 남긴다
    if (!iso) return vpn && asn ? {o: asn.org, v} : undefined;

    const c = COUNTRY_NAME_OVERRIDES[iso] ?? regionName.of(iso) ?? iso;
    return iso === "JP" || iso === "CN" || vpn ? {o: asn?.org, c, v} : {c};
};

/** 정렬된(겹치지 않는) 구간 목록을 앞으로만 훑는 커서 */
const cursor = <T>(ranges: Range<T>[]) => {
    ranges.sort((a, b) => a.start - b.start);
    let index = 0;
    return (at: number): { value?: T; next: number } => {
        while (index < ranges.length && ranges[index]!.end < at) index++;
        const range = ranges[index];
        if (!range) return {next: Infinity};
        return range.start <= at ? {value: range.value, next: range.end + 1} : {next: range.start};
    };
};

const atAsn = cursor(asns);
const atCountry = cursor(countries);
const atVpn = cursor(vpns);

/** prefix(a*256+b) → meta 키 → 주소 수 */
const counts = new Map<number, Map<string, number>>();

for (let at = 0; at <= 0xffffffff;) {
    const asn = atAsn(at);
    const country = atCountry(at);
    const vpn = atVpn(at);
    const end = Math.min(asn.next, country.next, vpn.next, (Math.floor(at / 65536) + 1) * 65536) - 1;

    const meta = metaOf(asn.value, country.value, vpn.value === true);
    if (meta && (meta.o || meta.c)) {
        const prefix = Math.floor(at / 65536);
        const key = JSON.stringify(meta);
        const byMeta = counts.get(prefix) ?? counts.set(prefix, new Map()).get(prefix)!;
        byMeta.set(key, (byMeta.get(key) ?? 0) + end - at + 1);
    }

    at = end + 1;
}

// ===== 출력 =====

/** prefix → 유력한 순 meta 키 */
const candidates = [...counts]
    .sort((a, b) => a[0] - b[0])
    .map(([prefix, byMeta]) => [
        prefix,
        [...byMeta]
            .sort((a, b) => b[1] - a[1])
            .filter(([, count], index) => index === 0 || count >= MIN_SHARE)
            .slice(0, MAX_CANDIDATES)
            .map(([key]) => key)
    ] as const);

// 자주 나오는 meta가 앞 번호를 받게 (JSON이 짧아진다)
const frequency = new Map<string, number>();
for (const [, keys] of candidates) for (const key of keys) frequency.set(key, (frequency.get(key) ?? 0) + 1);
const metaKeys = [...frequency.keys()].sort((a, b) => frequency.get(b)! - frequency.get(a)!);
const metaIndex = new Map(metaKeys.map((key, index) => [key, index]));

const data: RawIpData = {meta: metaKeys.map((key) => JSON.parse(key) as Meta), b: {}};
for (const [prefix, keys] of candidates) data.b[`${prefix >> 8}.${prefix & 255}`] = keys.map((key) => metaIndex.get(key)!);

// 자체 점검 — 확장과 같은 코드로 조회해 본다. 실패하면 파일을 쓰지 않는다
const lookup = createIpLookup(compactIpData(data));
const expect = (ip: string, check: (first: NonNullable<ReturnType<typeof lookup>>[number]) => boolean, label: string): void => {
    const first = lookup(ip)?.[0];
    if (!first || !check(first)) throw new Error(`점검 실패 ${ip} (${label}): ${JSON.stringify(lookup(ip))}`);
};
expect("175.223", (first) => first.org === "KT" && !first.country, "KT, 국가 없음");
expect("126.0", (first) => first.org === "SoftBank Corp." && first.country === "일본", "소프트뱅크 일본");
expect("36.110", (first) => first.country === "중국", "중국");
expect("3.34", (first) => first.vpn, "AWS VPN");
if (lookup("0.0") || lookup("255.255")) throw new Error("예약 대역에 데이터가 있습니다.");

await mkdir(outDir, {recursive: true});
await writeFile(join(outDir, "ip.json"), JSON.stringify(data));
await writeFile(join(outDir, "version"), new Date().toISOString().slice(0, 10));

const sizes = Object.values(data.b).map((list) => list.length);
console.log(`prefixes=${sizes.length} meta=${data.meta.length} maxCandidates=${Math.max(...sizes)} kisa=${kisa.size} vpnRanges=${vpns.length} size=${JSON.stringify(data).length}`);
