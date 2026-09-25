import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {compactIpData, createIpLookup, type IpCandidate, type RawIpData} from "@/core/ipdb";
import {dbStorage} from "@/core/storage/items";
import type {StoredDB} from "@/core/storage/types";

/** IP/갱차 데이터베이스를 내려받아 저장 — 배경(설치·주기)과 옵션 페이지(지금 갱신)에서 호출 */
export const updateDatabase = async (): Promise<void> => {
    const [version, ip, ban] = await Promise.all([
        http.get(urls.database.version).text(),
        http.get(urls.database.ip).json<RawIpData>(),
        http.get(urls.database.ban).json<StoredDB["ban"]>()
    ]);

    await dbStorage.setValue({version, lastUpdate: Date.now(), ip: compactIpData(ip), ban});
};

// ===== 콘텐츠 스크립트용 조회 (저장소 → 메모리) =====

/** 배지 색 구분 — 유력 후보(첫 번째)의 국가/VPN 기준 */
export type IpCategory = "korea" | "japan" | "china" | "foreign" | "vpn";

interface IpInfo {
    /** "KT, 부산은행" / "SoftBank Corp. (일본)" / "Tencent (VPN)" — 조직은 3개까지, 한국은 국가 생략 */
    label: string;
    /** 후보 전체 (툴팁용) */
    title: string;
    category: IpCategory;
}

let lookupIp: ((ip: string) => IpCandidate[] | undefined) | null = null;
/** ban은 이유 → uid[] 형태라 uid → 이유[] 역색인을 만들어 둔다 */
let bans = new Map<string, string[]>();

const load = (db: StoredDB | null): void => {
    // 예전 형식(ip가 대역→이름 객체)이면 다음 갱신 전까지 IP 정보 없이 둔다
    lookupIp = typeof db?.ip?.table === "string" ? createIpLookup(db.ip) : null;
    bans = new Map();

    for (const [reason, uids] of Object.entries(db?.ban ?? {})) {
        // ban.json은 손으로 올리는 파일 — 값 하나가 배열이 아니어도 여기서 던지면 initDatabase가 실패해 모든 모듈이 죽는다
        if (!Array.isArray(uids)) continue;
        for (const uid of uids) bans.set(uid, [...(bans.get(uid) ?? []), reason]);
    }
};

let initialized: Promise<void> | null = null;

/** 조회용 데이터 로드 + 변경 감시. 여러 번 불러도 1회 */
export const initDatabase = (): Promise<void> =>
    (initialized ??= (async () => {
        load(await dbStorage.getValue());
        dbStorage.watch(load);
    })().catch((e) => {
        // 실패를 붙들고 있으면 다음 호출도 계속 실패한다 — 비워 두어 다시 시도하게
        initialized = null;
        throw e;
    }));

const categoryOf = ({vpn, country}: IpCandidate): IpCategory => {
    if (vpn) return "vpn";
    if (!country) return "korea";
    if (country === "일본") return "japan";
    if (country === "중국") return "china";
    return "foreign";
};

/** 괄호 표시 — VPN이 국가보다 우선, 한국은 없음 */
const tagOf = ({vpn, country}: IpCandidate): string | undefined => (vpn ? "VPN" : country);

const withTag = (name: string, tag?: string): string => (name && tag ? `${name} (${tag})` : name || tag || "");

const MAX_ORGS = 3;

/** IP 대역(a.b)의 조직·국가·VPN 정보. 데이터가 없으면 undefined */
export const ipInfoOf = (ip: string): IpInfo | undefined => {
    const candidates = lookupIp?.(ip);
    const first = candidates?.[0];
    if (!candidates || !first) return undefined;

    const orgs = [...new Set(candidates.map((candidate) => candidate.org).filter((org): org is string => Boolean(org)))];
    const shown = orgs.slice(0, MAX_ORGS).join(", ") + (orgs.length > MAX_ORGS ? ` 외 ${orgs.length - MAX_ORGS}` : "");

    return {
        label: withTag(shown, tagOf(first)),
        title: candidates.map((candidate) => withTag(candidate.org ?? "(조직 미상)", tagOf(candidate))).join("\n"),
        category: categoryOf(first)
    };
};

/** IP 정보를 어떤 IP까지 보여 줄지 (userinfo ipInfoFilter) — 페이지와 미리보기가 같은 기준을 쓴다 */
export type IpInfoFilter = "all" | "foreign" | "vpn" | "none";

export const passesIpFilter = ({category}: IpInfo, filter: IpInfoFilter): boolean =>
    filter === "all" || (filter === "foreign" && category !== "korea") || (filter === "vpn" && category === "vpn");

/** 갱신 차단(밴) 이유들. 없으면 undefined */
export const banReasonsOf = (uid: string): string | undefined => bans.get(uid)?.join(", ");
