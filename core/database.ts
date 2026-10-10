import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {createIpLookup, type IpCandidate, IP_FORMAT, parseIpData} from "@/core/ipdb";
import {storage} from "wxt/utils/storage";
import {createStore} from "zustand/vanilla";

import {DB_KEYS, dbStorage, writeDatabase} from "@/core/storage/items";
import {watchStorage} from "@/core/storage/sync";
import type {BanList, DatabaseMeta} from "@/core/storage/types";
import {onBfcacheRestore} from "@/utils/dom";
import {once} from "@/utils/once";
import {isRecord} from "@/utils/record";

/**
 * DB 파일 하나를 받는다. 재시도하지 않는다. 실패하면 배경의 다음 알람이나 사용자의 "지금 갱신"이 다시 받는다.
 * 브라우저 캐시는 서버에 확인(ETag)한 뒤 쓴다. 서버가 ip·ban을 1시간 캐시하라고 주므로, 그대로 쓰면 새 버전이 올라온 뒤에도
 * 한 시간 안의 "지금 갱신"이 옛 파일을 받아 저장한다.
 * 전체 시간 제한은 두지 않는다. 느린 회선에서 수백 KB를 받는 도중에 끊긴다.
 */
const get = (url: string): Promise<string> => http.get(url, {retry: 0, cache: "no-cache", totalTimeout: false}).text();

/**
 * IP/밴 DB를 내려받아 저장한다. 배경이 부른다 (설치·주기, 옵션 페이지의 "지금 갱신" 메시지).
 * 서버 버전이 저장된 것과 같으면 본문(ip·ban 각각 수백 KB)은 받지 않고 확인 시각만 갱신한다. 다시 쓰면 열린 탭마다 IP DB를 다시 풀기 때문이다.
 * force: 사용자가 누른 "지금 갱신". 같은 버전이어도 다시 받는다.
 */
export const updateDatabase = async (force = false): Promise<void> => {
    const [version, meta] = await Promise.all([get(urls.database.version).then((text) => text.trim()), dbStorage.meta.getValue()]);
    // 저장 형식이 바뀌었으면(확장 업데이트) 같은 버전이어도 새 형식으로 다시 받는다.
    if (!force && version && version === meta.version.trim() && meta.format === IP_FORMAT) {
        await dbStorage.meta.setValue({...meta, lastUpdate: Date.now()});
        return;
    }

    const [ip, ban] = await Promise.all([get(urls.database.ip), get(urls.database.ban)]);

    // 서버가 저장 형식 그대로 주므로 받은 문자열을 저장한다. 깨졌거나 형식이 다르면 저장하지 않는다.
    const data = parseIpData(ip);
    if (!data) throw new Error("IP 데이터 형식이 올바르지 않습니다.");
    createIpLookup(data);
    // ban은 JSON인지만 본다 (깨졌으면 여기서 던진다).
    JSON.parse(ban);

    // version 파일과 ip.json은 CDN에 따로 캐시된다. 새 version에 옛 ip.json이 오면, 받은 데이터의 버전을 저장해 다음 확인 때 다시 받게 한다.
    await writeDatabase({version: data.version ?? version, lastUpdate: Date.now(), format: IP_FORMAT}, ip, ban);
};

/**
 * 저장된 ban 문자열을 푼다 (없으면 빈 목록). JSON이 깨졌으면 던진다.
 * ban.json은 손으로 관리하는 파일이라 uid 문자열 배열이 아닌 항목은 버린다.
 */
const parseBans = (stored: string): BanList => {
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([reason, uids]) =>
        Array.isArray(uids) ? [[reason, uids.filter((uid): uid is string => typeof uid === "string")]] : []));
};

// ===== 콘텐츠 스크립트용 조회 (저장소 → 메모리) =====

/** 배지 색 구분. 가장 유력한 후보(첫 번째)의 국가/VPN으로 정한다. */
export type IpCategory = "korea" | "japan" | "china" | "foreign" | "vpn";

interface IpInfo {
    /** "KT, 부산은행" / "SoftBank Corp. (일본)" / "Tencent (VPN)". 조직은 3개까지, 한국은 국가를 생략한다. */
    label: string;
    /** 후보 전체 (툴팁용). */
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
/** 감시로 받은 밴 DB 갱신 수. 처음 읽기가 늦게 끝나 새 값을 덮지 않게 견준다. */
let banVersion = 0;
/** 지금 읽어 둔 DB의 버전·형식 (모르면 빈 문자열). bfcache 복원 때 같으면 수백 KB를 다시 풀지 않는다. */
let loadedStamp = "";
const stampOf = ({version, format}: DatabaseMeta): string => `${version}
${format ?? ""}`;

// DB를 읽을 때마다 올리는 번호 (0이면 아직 안 읽음). 렌더 중에 조회하는 곳은 useSyncExternalStore로 이것을 구독한다.
// 이 파일은 배경도 불러오므로 React 훅은 쓰는 쪽에 두고, 번호는 React가 없는 zustand/vanilla 스토어에 둔다 (React가 배경 번들에 딸려 가지 않게).
const versionStore = createStore(() => 0);

export const databaseVersion = versionStore.getState;
/**
 * DB 변경 구독. 처음 구독할 때 DB를 읽기 시작한다(initDatabase). 유저 정보 모듈이 꺼져 있으면 버블·미리보기가 IP 정보를 처음
 * 그릴 때에야 수백 KB짜리 IP DB를 읽고, 읽은 뒤 번호가 올라 다시 그려진다. 모듈이 켜져 있으면 setup이 먼저 읽는다.
 */
export const subscribeDatabase = (listener: () => void): (() => void) => {
    void initDatabase().catch(console.error);
    return versionStore.subscribe(listener);
};

const bump = (): void => versionStore.setState((version) => version + 1);

// 깨진 값이어도 던지지 않고 IP 정보 없이 둔다. 던지면 initDatabase가 실패해 그것을 기다리는 userinfo 모듈의 setup까지 실패한다.
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
        for (const uid of uids) index.set(uid, index.has(uid) ? `${index.get(uid)}, ${reason}` : reason);
    }
    return index;
};

// 감시는 모듈이 아니라 페이지 단위다 (모듈이 꺼져도 버블·미리보기가 쓴다). 그래서 콘텐츠 스크립트가 무효화될 때 releaseDatabase로 푼다.
const watching = new AbortController();

/**
 * DB 감시를 푼다. 콘텐츠 스크립트가 무효화되면 부른다.
 * 파이어폭스는 다시 주입한 뒤에도 죽은 인스턴스가 남아, 풀지 않으면 DB가 바뀔 때마다 수백 KB를 다시 푼다.
 */
export const releaseDatabase = (): void => watching.abort();

/** 조회용 데이터 로드 + 변경 감시. 여러 번 불러도 1회. */
export const initDatabase = once(async () => {
    // 읽기가 실패하면 once가 다음 호출에 다시 시도한다. 이번에 건 감시는 풀어야 시도할 때마다 감시가 쌓이지 않는다.
    const attempt = new AbortController();
    const signal = AbortSignal.any([watching.signal, attempt.signal]);
    // 감시를 먼저 건다. 읽는 사이 받은 갱신이 오면 읽은 값(갱신 전일 수 있다)은 버린다.
    let updated = false;
    watchStorage<string>(DB_KEYS.ip, (next) => {
        updated = true;
        loadedStamp = "";
        loadIp(next ?? "");
    }, signal);
    const [ip, meta] = await Promise.all([storage.getItem<string>(DB_KEYS.ip, {fallback: ""}), dbStorage.meta.getValue()]).catch((e: unknown) => {
        attempt.abort();
        throw e;
    });
    if (!updated) {
        loadedStamp = stampOf(meta);
        loadIp(ip);
    }
    // 밴은 한 번이라도 읽었을 때만 새 값을 따라간다.
    watchStorage<string>(DB_KEYS.ban, (next) => {
        if (!bansRequested) return;
        banVersion++;
        loadBans(next ?? "");
    }, signal);
    // bfcache에 있는 동안 받은 DB 갱신은 watch로 오지 않는다. 버전이 그대로면(대부분) 작은 meta만 읽고 끝낸다.
    onBfcacheRestore(async () => {
        const stamp = stampOf(await dbStorage.meta.getValue());
        if (stamp === loadedStamp) return;
        const [ip, ban] = await Promise.all([storage.getItem<string>(DB_KEYS.ip, {fallback: ""}), bansRequested ? storage.getItem<string>(DB_KEYS.ban, {fallback: ""}) : null]);
        loadedStamp = stamp;
        loadIp(ip);
        if (ban !== null) loadBans(ban);
    }, signal);
});

const categoryOf = ({vpn, country}: IpCandidate): IpCategory => {
    if (vpn) return "vpn";
    if (!country) return "korea";
    if (country === "일본") return "japan";
    if (country === "중국") return "china";
    return "foreign";
};

/** 괄호 안 표시. VPN이 국가보다 우선이고, 한국은 붙이지 않는다. */
const tagOf = ({vpn, country}: IpCandidate): string | undefined => (vpn ? "VPN" : country);

const withTag = (name: string, tag?: string): string => (name && tag ? `${name} (${tag})` : name || tag || "");

const MAX_ORGS = 3;

/** IP 대역(a.b)의 조직·국가·VPN 정보. 데이터가 없으면 undefined다. */
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

/** IP 정보를 어떤 IP까지 보여 줄지 (userinfo ipInfoFilter). 페이지와 미리보기가 같은 기준을 쓴다. */
export type IpInfoFilter = "all" | "foreign" | "vpn" | "none";

export const passesIpFilter = ({category}: IpInfo, filter: IpInfoFilter): boolean =>
    filter === "all" || (filter === "foreign" && category !== "korea") || (filter === "vpn" && category === "vpn");

/** 갱신 차단(밴) 이유들. 없으면 undefined이고, 첫 호출이 밴 DB를 읽기 시작하므로 다 읽기 전에도 undefined다. */
export const banReasonsOf = (uid: string): string | undefined => {
    if (!bansRequested) {
        bansRequested = true;
        // 읽는 사이 감시가 새 값을 먼저 넣었으면 읽은 값(갱신 전일 수 있다)은 버린다. 읽기에 실패하면 다음 호출이 다시 읽는다.
        const version = banVersion;
        void storage.getItem<string>(DB_KEYS.ban, {fallback: ""}).then((stored) => {
            if (banVersion === version) loadBans(stored);
        }, (e: unknown) => {
            bansRequested = false;
            console.error(e);
        });
    }
    return bans?.get(uid);
};
