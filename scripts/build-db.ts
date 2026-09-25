/// <reference types="bun" />

import ky from "ky";
import {type AsnResponse, type CountryResponse, Reader} from "mmdb-lib";
import {long2ip, Netmask} from "netmask";

import {compactIpData, createIpLookup, type RawIpData} from "../core/ipdb";

import {shortenOrg} from "./shorten-org";

const MMDB_URL = (edition: string): string => `https://github.com/green1052/maxmind-geoip2/raw/master/dist/${edition}/${edition}.mmdb`;
const VPN_URL = "https://raw.githubusercontent.com/X4BNet/lists_vpn/refs/heads/main/ipv4.txt";
const KISA_URL = "https://xn--3e0bx5euxnjje69i70af08bea817g.xn--3e0b707e/jsp/business/management/asList.jsp";

/** Intl 이름이 길거나 국내에서 덜 쓰는 표기인 것만 */
const COUNTRY_NAME_OVERRIDES: Record<string, string> = {HK: "홍콩", MO: "마카오", AU: "호주"};

const MAX_CANDIDATES = 8;
const MIN_SHARE = 65536 / 100;

const OUT_DIR = "db";

type Range<T> = { start: number; end: number; value: T };

/** MMDB의 IPv4 전체를 주소 순으로 — 라이브러리에 순회가 없어 네트워크 끝으로 건너뛰며 조회한다 */
const readMmdb = async <T, V>(edition: string, pick: (record: T) => V | undefined): Promise<Range<V>[]> => {
    // 디코더 캐시 — 수많은 네트워크가 같은 레코드(국가·ASN)를 가리켜 같은 디코드를 되풀이한다. 순회가 몇 배 빨라지고 출력은 같다
    const reader = new Reader<T & object>(Buffer.from(await ky.get(MMDB_URL(edition)).arrayBuffer()), {cache: new Map()});
    const ranges: Range<V>[] = [];

    for (let start = 0; start <= 0xffffffff;) {
        const [record, prefixLength] = reader.getWithPrefixLength(long2ip(start));
        const end = start + 2 ** (32 - prefixLength) - 1;
        const value = record ? pick(record) : undefined;
        if (value !== undefined) ranges.push({start, end, value});
        start = end + 1;
    }

    return ranges;
};

// ===== 입력 =====

const regionName = new Intl.DisplayNames(["ko"], {type: "region"});

const countries = await readMmdb<CountryResponse, string>(
    "GeoLite2-Country",
    (record) => record.country?.iso_code ?? record.registered_country?.iso_code
);

const asns = await readMmdb<AsnResponse, { asn: number; org: string }>(
    "GeoLite2-ASN",
    (record) => ({asn: record.autonomous_system_number, org: record.autonomous_system_organization})
);

const vpns: Range<true>[] = [];
for (const line of (await ky.get(VPN_URL).text()).split("\n")) {
    if (!line.trim()) continue;
    const network = new Netmask(line.trim());
    vpns.push({start: network.netLong, end: network.netLong + network.size - 1, value: true});
}

/** AS 번호 → KISA 한글 기관명 */
const kisa = new Map<number, string>();
for (const [, org, asn] of (await ky.get(KISA_URL).text()).matchAll(/<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>AS(\d+)<\/td>/g)) {
    kisa.set(Number(asn), shortenOrg(org!.trim()));
}

if (asns.length < 100_000 || countries.length < 100_000) throw new Error("MaxMind 데이터가 너무 작습니다.");
if (vpns.length < 10_000) throw new Error(`VPN 목록이 너무 작습니다: ${vpns.length}`);
if (kisa.size < 500) throw new Error(`KISA 목록을 읽지 못했습니다: ${kisa.size}`);

// ===== /16마다 후보별 주소 수 =====

type Meta = RawIpData["meta"][number];

const metaOf = (asn: {
    asn: number;
    org: string
} | undefined, iso: string | undefined, vpn: boolean): Meta | undefined => {
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

await Bun.write(`${OUT_DIR}/ip.json`, JSON.stringify(data));
await Bun.write(`${OUT_DIR}/version`, new Date().toISOString().slice(0, 10));

const sizes = Object.values(data.b).map((list) => list.length);
console.log(`prefixes=${sizes.length} meta=${data.meta.length} maxCandidates=${Math.max(...sizes)} kisa=${kisa.size} vpnRanges=${vpns.length} size=${JSON.stringify(data).length}`);
