/**
 * IP DB 후보 계산 (build-db.ts). 내려받은 구간 목록으로 /16 대역마다 후보를 고르고, ban.json을 검사·정리한다.
 * 내려받기와 떼어 놓아 테스트에서 불러올 수 있다.
 */

import {candidateKey, type IpCandidate} from "../core/ipdb";
import type {BanList} from "../core/storage/types";
import {isRecord} from "../utils/record";

/** /16마다 후보는 이만큼까지. 가장 큰 후보 말고는 대역의 1% 이상을 차지해야 남는다. */
const MAX_CANDIDATES = 8;
const MIN_SHARE = 65536 / 100;

/** Intl 이름이 길거나 국내에서 덜 쓰는 표기인 것만. */
const COUNTRY_NAME_OVERRIDES: Record<string, string> = {HK: "홍콩", MO: "마카오", AU: "호주"};

/** IPv4 주소 구간 [start, end]와 그 값. 목록은 start 순이고 겹치지 않는다. */
export interface Range<T> {
    start: number;
    end: number;
    value: T;
}

export interface Asn {
    asn: number;
    org: string;
}

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
export const buildCandidates = (asns: Range<Asn>[], countries: Range<string>[], vpns: Range<true>[], kisa: Map<number, string>): Map<number, IpCandidate[]> => {
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
export const normalizeBans = (data: unknown): BanList => {
    if (!isRecord(data)) throw new Error("ban.json은 갤러리 → 아이디 목록 객체여야 합니다.");

    return Object.fromEntries(Object.keys(data).sort().map((gallery) => {
        const uids = data[gallery];
        if (!Array.isArray(uids) || !uids.every((uid): uid is string => typeof uid === "string")) throw new Error(`ban.json의 "${gallery}"가 문자열 목록이 아닙니다.`);
        return [gallery, [...new Set(uids.map((uid) => uid.trim()).filter(Boolean))].sort()];
    }));
};
