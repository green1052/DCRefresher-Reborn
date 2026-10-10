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

import {encodeIpData} from "../core/ipdb";

import {type Asn, buildCandidates, normalizeBans, type Range} from "./ip-candidates";
import {shortenOrg} from "./shorten-org";

const OUT_DIR = "db";

/** MaxMind 데이터가 이보다 오래되면 만들지 않는다 (ms). */
const MAX_MMDB_AGE = 45 * 86_400_000;

const MMDB_URL = (edition: string): string => `https://github.com/green1052/maxmind-geoip2/raw/master/dist/${edition}/${edition}.mmdb`;
const VPN_URL = "https://raw.githubusercontent.com/X4BNet/lists_vpn/refs/heads/main/ipv4.txt";
const KISA_URL = "https://xn--3e0bx5euxnjje69i70af08bea817g.xn--3e0b707e/jsp/business/management/asList.jsp";

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
