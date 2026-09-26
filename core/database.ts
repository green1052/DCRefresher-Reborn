import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {type CompactIpData, compactIpData, createIpLookup, type IpCandidate, type RawIpData} from "@/core/ipdb";
import {dbStorage, writeDatabase} from "@/core/storage/items";
import type {BanList} from "@/core/storage/types";
import {once} from "@/utils/once";

/** IP/갱차 데이터베이스를 내려받아 저장 — 배경(설치·주기)과 옵션 페이지(지금 갱신)에서 호출 */
export const updateDatabase = async (): Promise<void> => {
    const [version, ip, ban] = await Promise.all([
        http.get(urls.database.version).text(),
        http.get(urls.database.ip).json<RawIpData>(),
        http.get(urls.database.ban).json<BanList>()
    ]);

    await writeDatabase({version, lastUpdate: Date.now()}, JSON.stringify(compactIpData(ip)), JSON.stringify(ban));
};

/** 저장된 ip 문자열을 푼다 (없으면 null). 깨졌으면 던진다 */
export const parseIp = (stored: string): CompactIpData | null => (stored ? (JSON.parse(stored) as CompactIpData) : null);

/** 저장된 ban 문자열을 푼다 (없으면 빈 목록). 깨졌으면 던진다 */
export const parseBans = (stored: string): BanList => (stored ? (JSON.parse(stored) as BanList) : {});

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
/**
 * uid → 이유들. 저장된 ban은 이유 → uid[] 형태라 뒤집어 둔다.
 * 기본 설정에선 버블 말고 안 쓰니 처음 물을 때 읽기 시작하고(그동안은 없음), 다 읽으면 번호를 올려 다시 그리게 한다
 */
let bans: Map<string, string> | null = null;
let bansRequested = false;

// 읽을 때마다 올리는 번호 (0이면 아직 안 읽음) — 렌더 중에 조회하는 곳이 useSyncExternalStore로 구독한다.
// React Compiler는 조회를 인자로만 메모하므로 이 번호를 식에 넣어야 DB가 바뀐 뒤 다시 계산한다 (React는 배경 번들에 딸려 가 여기서 부르지 않는다)
let version = 0;
const listeners = new Set<() => void>();

export const databaseVersion = (): number => version;

export const subscribeDatabase = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
};

const bump = (): void => {
    version++;
    for (const listener of listeners) listener();
};

// 깨진 값에 여기서 던지면 initDatabase가 실패해 모든 모듈이 죽는다 — 그 정보 없이 둔다
const loadIp = (stored: string): void => {
    lookupIp = null;
    try {
        const ip = parseIp(stored);
        lookupIp = ip ? createIpLookup(ip) : null;
    } catch (e) {
        console.error("IP DB를 읽지 못했습니다.", e);
    }
    bump();
};

const loadBans = (stored: string): void => {
    bans = new Map();
    try {
        bans = indexBans(parseBans(stored));
    } catch (e) {
        console.error("밴 DB를 읽지 못했습니다.", e);
    }
    bump();
};

const indexBans = (list: BanList): Map<string, string> => {
    const index = new Map<string, string>();
    for (const [reason, uids] of Object.entries(list)) {
        // ban.json은 손으로 올리는 파일 — 배열이 아닌 값은 건너뛴다
        if (!Array.isArray(uids)) continue;
        for (const uid of uids) index.set(uid, index.has(uid) ? `${index.get(uid)}, ${reason}` : reason);
    }
    return index;
};

/** 조회용 데이터 로드 + 변경 감시. 여러 번 불러도 1회 */
export const initDatabase = once(async () => {
    loadIp(await dbStorage.ip.getValue());
    dbStorage.ip.watch(loadIp);
    // 밴은 한 번이라도 읽었을 때만 새 값을 따라간다
    dbStorage.ban.watch((next) => {
        if (bansRequested) loadBans(next);
    });
});

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
export const banReasonsOf = (uid: string): string | undefined => {
    if (!bansRequested) {
        bansRequested = true;
        void dbStorage.ban.getValue().then(loadBans, console.error);
    }
    return bans?.get(uid);
};
