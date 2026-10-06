/// <reference types="bun" />

/**
 * IP·밴 DB 만들기. .github/workflows/db.yml이 수·토요일에 돌려 db/ 폴더를 data 브랜치로 올린다.
 *
 * - ip.json: MaxMind(국가·ASN), VPN 목록, KISA 기관명 → /16 대역마다 유력한 후보 → 확장이 저장하는 형식 (core/ipdb)
 * - ban.json: 손으로 관리하는 "갤러리 → 아이디 목록". 워크플로가 data 브랜치에서 가져다 두면 검사하고 정리한다.
 */

import ky from "ky";
import {type AsnResponse, type CountryResponse, Reader} from "mmdb-lib";
import {long2ip, Netmask} from "netmask";

import {candidateKey, encodeIpData, type IpCandidate} from "../core/ipdb";
import type {BanList} from "../core/storage/types";
import {isRecord} from "../utils/record";

import {shortenOrg} from "./shorten-org";

const OUT_DIR = "db";

/** MaxMind 데이터가 이보다 오래되면 만들지 않는다 (ms). */
const MAX_MMDB_AGE = 45 * 86_400_000;

const MMDB_URL = (edition: string): string => `https://github.com/green1052/maxmind-geoip2/raw/master/dist/${edition}/${edition}.mmdb`;
const VPN_URL = "https://raw.githubusercontent.com/X4BNet/lists_vpn/refs/heads/main/ipv4.txt";
const KISA_URL = "https://xn--3e0bx5euxnjje69i70af08bea817g.xn--3e0b707e/jsp/business/management/asList.jsp";

/** /16마다 후보는 이만큼까지. 가장 큰 후보 말고는 대역의 1% 이상을 차지해야 남는다. */
const MAX_CANDIDATES = 8;
const MIN_SHARE = 65536 / 100;

/** Intl 이름이 길거나 국내에서 덜 쓰는 표기인 것만. */
const COUNTRY_NAME_OVERRIDES: Record<string, string> = {HK: "홍콩", MO: "마카오", AU: "호주"};

/** IPv4 주소 구간 [start, end]와 그 값. 목록은 start 순이고 겹치지 않는다. */
interface Range<T> {
    start: number;
    end: number;
    value: T;
}

interface Asn {
    asn: number;
    org: string;
}

// ===== 입력 =====

/** MMDB의 IPv4 전체를 주소 순으로. 라이브러리에 순회가 없어 네트워크 끝으로 건너뛰며 조회한다. */
const readMmdb = async <T, V>(edition: string, pick: (record: T) => V | undefined): Promise<Range<V>[]> => {
    // 수많은 네트워크가 같은 레코드(국가·ASN)를 가리킨다. 디코더 캐시를 주면 같은 디코드를 되풀이하지 않는다.
    const reader = new Reader<T & object>(Buffer.from(await ky.get(MMDB_URL(edition)).arrayBuffer()), {cache: new Map()});
    // 미러가 갱신을 멈추면 크기 검사로는 알 수 없고, 낡은 데이터가 새 버전으로 계속 올라간다. GeoLite는 일주일에 두 번 나온다.
    const age = Date.now() - reader.metadata.buildEpoch.getTime();
    if (age > MAX_MMDB_AGE) throw new Error(`${edition}가 ${Math.floor(age / 86_400_000)}일 전 데이터입니다. 미러가 갱신되는지 확인하세요.`);
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

const readVpns = async (): Promise<Range<true>[]> =>
    (await ky.get(VPN_URL).text())
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((cidr) => new Netmask(cidr))
        .map((network): Range<true> => ({start: network.netLong, end: network.netLong + network.size - 1, value: true}))
        .sort((a, b) => a.start - b.start);

/** AS 번호 → KISA 한글 기관명 (줄인 이름). */
const readKisa = async (): Promise<Map<number, string>> => {
    const html = await ky.get(KISA_URL).text();
    return new Map(Array.from(html.matchAll(/<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>AS(\d+)<\/td>/g), ([, org, asn]) => [Number(asn), shortenOrg(org!.trim())]));
};

// ===== 대역별 후보 =====

const regionName = new Intl.DisplayNames(["ko"], {type: "region"});

/** 한 주소 구간의 후보. 보여 줄 것이 없으면 undefined다. */
const candidateOf = (kisa: Map<number, string>, asn: Asn | undefined, iso: string | undefined, vpn: boolean): IpCandidate | undefined => {
    // 한국은 국가를 생략하고 기관명만. KISA 이름이 있으면 그것으로.
    if (iso === "KR") {
        const org = (asn && kisa.get(asn.asn)) ?? asn?.org;
        return org ? {org, vpn} : undefined;
    }
    // 국가를 모르면 배지가 한국처럼 보이므로 VPN일 때만 기관명으로 남긴다.
    if (!iso) return vpn && asn?.org ? {org: asn.org, vpn} : undefined;

    const country = COUNTRY_NAME_OVERRIDES[iso] ?? regionName.of(iso) ?? iso;
    // 해외는 국가만. 일본·중국·VPN은 기관명도 보여 준다.
    return iso === "JP" || iso === "CN" || vpn ? {org: asn?.org, country, vpn} : {country, vpn};
};

/** 정렬된 구간 목록을 앞으로만 훑는 커서. at에 걸친 값과, 값이 바뀌는 다음 주소를 준다. */
const cursor = <T>(ranges: Range<T>[]) => {
    let index = 0;
    return (at: number): { value?: T; next: number } => {
        while (index < ranges.length && ranges[index]!.end < at) index++;
        const range = ranges[index];
        if (!range) return {next: Infinity};
        return range.start <= at ? {value: range.value, next: range.end + 1} : {next: range.start};
    };
};

/**
 * /16 대역(a*256+b, 오름차순) → 유력한 순 후보.
 * 세 출처의 값이 모두 같은 구간씩 건너뛰며 후보별 주소 수를 세고, 많은 순으로 고른다.
 */
const buildCandidates = (asns: Range<Asn>[], countries: Range<string>[], vpns: Range<true>[], kisa: Map<number, string>): Map<number, IpCandidate[]> => {
    const atAsn = cursor(asns);
    const atCountry = cursor(countries);
    const atVpn = cursor(vpns);

    const counts = new Map<number, Map<string, { candidate: IpCandidate; addresses: number }>>();

    for (let at = 0; at <= 0xffffffff;) {
        const asn = atAsn(at);
        const country = atCountry(at);
        const vpn = atVpn(at);
        const prefix = Math.floor(at / 65536);
        // /16 경계에서도 끊는다.
        const end = Math.min(asn.next, country.next, vpn.next, (prefix + 1) * 65536) - 1;

        const candidate = candidateOf(kisa, asn.value, country.value, vpn.value === true);
        if (candidate) {
            const byCandidate = counts.get(prefix) ?? new Map();
            counts.set(prefix, byCandidate);
            const key = candidateKey(candidate);
            const entry = byCandidate.get(key);
            if (entry) entry.addresses += end - at + 1;
            else byCandidate.set(key, {candidate, addresses: end - at + 1});
        }

        at = end + 1;
    }

    // 주소 순으로 훑었으므로 대역은 이미 오름차순이다.
    return new Map([...counts].map(([prefix, byCandidate]) => [
        prefix,
        [...byCandidate.values()]
            .sort((a, b) => b.addresses - a.addresses)
            .filter(({addresses}, index) => index === 0 || addresses >= MIN_SHARE)
            .slice(0, MAX_CANDIDATES)
            .map(({candidate}) => candidate)
    ]));
};

// ===== ban.json =====

/** 손으로 고치는 파일이라 형식을 검사한다. 아이디는 앞뒤 공백·빈 값·중복을 빼고, 갤러리와 아이디를 정렬해 diff를 안정시킨다. */
const normalizeBans = (data: unknown): BanList => {
    if (!isRecord(data)) throw new Error("ban.json은 갤러리 → 아이디 목록 객체여야 합니다.");

    return Object.fromEntries(Object.keys(data).sort().map((gallery) => {
        const uids = data[gallery];
        if (!Array.isArray(uids) || !uids.every((uid): uid is string => typeof uid === "string")) throw new Error(`ban.json의 "${gallery}"가 문자열 목록이 아닙니다.`);
        return [gallery, [...new Set(uids.map((uid) => uid.trim()).filter(Boolean))].sort()];
    }));
};

// ===== 실행 =====

const [countries, asns, vpns, kisa] = await Promise.all([
    readMmdb<CountryResponse, string>("GeoLite2-Country", (record) => record.country?.iso_code ?? record.registered_country?.iso_code),
    readMmdb<AsnResponse, Asn>("GeoLite2-ASN", (record) => ({asn: record.autonomous_system_number, org: record.autonomous_system_organization})),
    readVpns(),
    readKisa()
]);

// 출처가 깨졌거나 모양이 바뀌면 멈춘다. 워크플로가 실패하면 data 브랜치는 이전 DB 그대로다.
if (asns.length < 100_000 || countries.length < 100_000) throw new Error("MaxMind 데이터가 너무 작습니다.");
if (vpns.length < 10_000) throw new Error(`VPN 목록이 너무 작습니다: ${vpns.length}`);
if (kisa.size < 500) throw new Error(`KISA 목록을 읽지 못했습니다: ${kisa.size}`);

const candidates = buildCandidates(asns, countries, vpns, kisa);
if (candidates.size < 40_000) throw new Error(`대역이 너무 적습니다: ${candidates.size}`);

// 분까지 넣는다. 날짜만 쓰면 같은 날 다시 만든 DB(ban.json 수정 등)를 확장이 같은 버전으로 보고 받지 않는다.
const version = new Date().toISOString().slice(0, 16);
const ip = JSON.stringify({...encodeIpData(candidates), version});
await Bun.write(`${OUT_DIR}/ip.json`, ip);
await Bun.write(`${OUT_DIR}/version`, version);

const banFile = Bun.file(`${OUT_DIR}/ban.json`);
const bans = (await banFile.exists()) ? normalizeBans(await banFile.json()) : undefined;
if (bans) await Bun.write(banFile, JSON.stringify(bans));

const listSizes = [...candidates.values()].map((list) => list.length);
console.log(
    `prefixes=${candidates.size} maxCandidates=${Math.max(...listSizes)} kisa=${kisa.size} vpnRanges=${vpns.length} ip=${ip.length}` +
    (bans ? ` banGalleries=${Object.keys(bans).length} banUids=${Object.values(bans).reduce((sum, uids) => sum + uids.length, 0)}` : "")
);
