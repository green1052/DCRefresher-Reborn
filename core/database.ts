import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {createIpLookup, type IpCandidate, IP_FORMAT, parseIpData} from "@/core/ipdb";
import {storage} from "wxt/utils/storage";
import {createStore} from "zustand/vanilla";

import {DB_KEYS, dbStorage, writeDatabase} from "@/core/storage/items";
import type {BanList} from "@/core/storage/types";
import {onBfcacheRestore} from "@/utils/dom";
import {once} from "@/utils/once";

/** DB 파일 하나를 받는다. 재시도하지 않는다. 실패하면 배경의 다음 알람이나 사용자의 "지금 갱신"이 다시 받는다 */
const get = (url: string): Promise<string> => http.get(url, {retry: 0}).text();

/**
 * IP/밴 DB를 내려받아 저장한다. 배경(설치·주기)과 옵션 페이지(지금 갱신)가 부른다.
 * 서버 버전이 저장된 것과 같으면 본문(ip·ban 각각 수백 KB)은 받지 않고 확인 시각만 갱신한다. 다시 쓰면 열린 탭마다 IP DB를 다시 풀기 때문이다.
 * force: 사용자가 누른 "지금 갱신". 같은 버전이어도 다시 받는다.
 */
export const updateDatabase = async (force = false): Promise<void> => {
    const version = (await get(urls.database.version)).trim();
    const meta = await dbStorage.meta.getValue();
    // 저장 형식이 바뀌었으면(확장 업데이트) 같은 버전이어도 새 형식으로 다시 받는다
    if (!force && version && version === meta.version.trim() && meta.format === IP_FORMAT) {
        await dbStorage.meta.setValue({...meta, lastUpdate: Date.now()});
        return;
    }

    const [ip, ban] = await Promise.all([get(urls.database.ip), get(urls.database.ban)]);

    // 서버가 저장 형식 그대로 주므로 받은 문자열을 저장한다. 깨졌거나 형식이 다르면 저장하지 않는다
    const data = parseIpData(ip);
    if (!data) throw new Error("IP 데이터 형식이 올바르지 않습니다.");
    createIpLookup(data);
    // ban은 JSON인지만 본다 (깨졌으면 여기서 던진다)
    JSON.parse(ban);

    // version 파일과 ip.json은 CDN에 따로 캐시된다. 새 version에 옛 ip.json이 오면, 받은 데이터의 버전을 저장해 다음 확인 때 다시 받게 한다
    await writeDatabase({version: data.version ?? version, lastUpdate: Date.now(), format: IP_FORMAT}, ip, ban);
};

/** 저장된 ban 문자열을 푼다 (없으면 빈 목록). 깨졌으면 던진다 */
export const parseBans = (stored: string): BanList => (stored ? (JSON.parse(stored) as BanList) : {});

// ===== 콘텐츠 스크립트용 조회 (저장소 → 메모리) =====

/** 배지 색 구분. 가장 유력한 후보(첫 번째)의 국가/VPN으로 정한다 */
export type IpCategory = "korea" | "japan" | "china" | "foreign" | "vpn";

interface IpInfo {
    /** "KT, 부산은행" / "SoftBank Corp. (일본)" / "Tencent (VPN)". 조직은 3개까지, 한국은 국가를 생략한다 */
    label: string;
    /** 후보 전체 (툴팁용) */
    title: string;
    category: IpCategory;
}

let lookupIp: ((ip: string) => IpCandidate[] | undefined) | null = null;
/**
 * uid → 이유들. 저장된 ban은 갤러리 → uid[] 형태라 뒤집어 둔다. 갤러리 이름이 그대로 갱차 이유로 보인다.
 * 기본 설정에서는 유저 버블만 쓰므로 처음 조회할 때 읽기 시작한다. 읽는 동안은 null이고, 다 읽으면 번호(bump)를 올려 다시 그리게 한다.
 */
let bans: Map<string, string> | null = null;
let bansRequested = false;

// DB를 읽을 때마다 올리는 번호 (0이면 아직 안 읽음). 렌더 중에 조회하는 곳은 useSyncExternalStore로 이것을 구독한다.
// React Compiler는 인자만 보고 메모하므로 이 번호를 식에 넣어야 DB가 바뀐 뒤 다시 계산한다.
// 이 파일은 배경도 불러오므로 React 훅은 쓰는 쪽에 두고, 번호는 React가 없는 zustand/vanilla 스토어에 둔다 (React가 배경 번들에 딸려 가지 않게).
const versionStore = createStore(() => 0);

export const databaseVersion = versionStore.getState;
/**
 * DB 변경 구독. 처음 구독할 때 DB를 읽기 시작한다(initDatabase). 유저 정보 모듈이 꺼져 있으면 버블·미리보기가 IP 정보를 처음
 * 그릴 때에야 수백 KB짜리 IP DB를 읽고, 읽은 뒤 번호가 올라 다시 그려진다. 모듈이 켜져 있으면 setup이 먼저 읽는다
 */
export const subscribeDatabase = (listener: () => void): (() => void) => {
    void initDatabase().catch(console.error);
    return versionStore.subscribe(listener);
};

const bump = (): void => versionStore.setState((version) => version + 1);

// 깨진 값이어도 던지지 않고 IP 정보 없이 둔다. 던지면 initDatabase가 실패해 그것을 기다리는 userinfo 모듈의 setup까지 실패한다
const loadIp = (stored: string): void => {
    lookupIp = null;
    try {
        const ip = parseIpData(stored);
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
        // ban.json은 손으로 관리하는 파일이라 배열이 아닌 값은 건너뛴다
        if (!Array.isArray(uids)) continue;
        for (const uid of uids) index.set(uid, index.has(uid) ? `${index.get(uid)}, ${reason}` : reason);
    }
    return index;
};

/** 조회용 데이터 로드 + 변경 감시. 여러 번 불러도 1회 */
export const initDatabase = once(async () => {
    loadIp(await storage.getItem<string>(DB_KEYS.ip, {fallback: ""}));
    storage.watch<string>(DB_KEYS.ip, (next) => loadIp(next ?? ""));
    // 밴은 한 번이라도 읽었을 때만 새 값을 따라간다
    storage.watch<string>(DB_KEYS.ban, (next) => {
        if (bansRequested) loadBans(next ?? "");
    });
    // bfcache에 있는 동안 받은 DB 갱신은 watch로 오지 않는다
    onBfcacheRestore(async () => {
        loadIp(await storage.getItem<string>(DB_KEYS.ip, {fallback: ""}));
        if (bansRequested) loadBans(await storage.getItem<string>(DB_KEYS.ban, {fallback: ""}));
    });
});

const categoryOf = ({vpn, country}: IpCandidate): IpCategory => {
    if (vpn) return "vpn";
    if (!country) return "korea";
    if (country === "일본") return "japan";
    if (country === "중국") return "china";
    return "foreign";
};

/** 괄호 안 표시. VPN이 국가보다 우선이고, 한국은 붙이지 않는다 */
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

/** IP 정보를 어떤 IP까지 보여 줄지 (userinfo ipInfoFilter). 페이지와 미리보기가 같은 기준을 쓴다 */
export type IpInfoFilter = "all" | "foreign" | "vpn" | "none";

export const passesIpFilter = ({category}: IpInfo, filter: IpInfoFilter): boolean =>
    filter === "all" || (filter === "foreign" && category !== "korea") || (filter === "vpn" && category === "vpn");

/** 갱신 차단(밴) 이유들. 없으면 undefined이고, 첫 호출이 밴 DB를 읽기 시작하므로 다 읽기 전에도 undefined다 */
export const banReasonsOf = (uid: string): string | undefined => {
    if (!bansRequested) {
        bansRequested = true;
        // 읽기에 실패하면 다음 호출이 다시 읽는다
        void storage.getItem<string>(DB_KEYS.ban, {fallback: ""}).then(loadBans, (e: unknown) => {
            bansRequested = false;
            console.error(e);
        });
    }
    return bans?.get(uid);
};
