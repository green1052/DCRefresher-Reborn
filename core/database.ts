import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {createIpLookup, type IpCandidate, IP_FORMAT, parseIpData, parseStoredIpData} from "@/core/ipdb";
import {storage} from "wxt/utils/storage";
import {createStore} from "zustand/vanilla";

import {DB_KEYS, DB_META_KEY, dbMetaStorage, writeDatabase} from "@/core/storage/items";
import {watchStorage} from "@/core/storage/sync";
import type {BanList, DatabaseMeta} from "@/core/storage/types";
import {onBfcacheRestore} from "@/utils/dom";
import {once} from "@/utils/once";
import {isRecord} from "@/utils/record";

/** DB 파일 하나를 받는다. 서버가 1시간 캐시를 주므로 no-cache로 확인 뒤 쓴다. */
const get = (url: string): Promise<string> => http.get(url, {retry: 0, cache: "no-cache", totalTimeout: false}).text();

/** IP/밴 DB를 내려받아 저장한다. 같은 버전이면 본문은 안 받는다(탭마다 다시 풀지 않게). */
export const updateDatabase = async (force = false): Promise<void> => {
    const [version, meta] = await Promise.all([get(urls.database.version).then((text) => text.trim()), dbMetaStorage().getValue()]);
    // 같은 버전·형식이면 건너뛴다. 옛 메타는 version이 없어 ?? ""로 trim이 던지지 않게 한다.
    if (!force && version && version === (meta.version ?? "").trim() && meta.format === IP_FORMAT) {
        await dbMetaStorage().setValue({...meta, lastUpdate: Date.now()});
        return;
    }

    const [ip, ban] = await Promise.all([get(urls.database.ip), get(urls.database.ban)]);

    // 받은 문자열을 그대로 저장하므로 형식을 검사한다.
    const data = parseIpData(ip);
    if (!data) throw new Error("IP 데이터 형식이 올바르지 않습니다.");
    createIpLookup(data);
    // ban은 JSON인지만 본다 (깨졌으면 여기서 던진다).
    JSON.parse(ban);

    // version과 ip.json은 따로 캐시되어 어긋날 수 있다. 그때는 확인 시각을 그대로 둬 알람이 다시 받게 한다.
    const stale = data.version !== undefined && data.version !== version;
    await writeDatabase({version: data.version ?? version, lastUpdate: stale ? meta.lastUpdate : Date.now(), format: IP_FORMAT}, ip, ban);
};

/** 저장된 ban 문자열을 푼다. 손으로 관리하는 파일이라 배열 아닌 항목은 버린다. */
const parseBans = (stored: string): BanList => {
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([reason, uids]) =>
        Array.isArray(uids) ? [[reason, uids.filter((uid): uid is string => typeof uid === "string")]] : []));
};

// ===== 콘텐츠 스크립트용 조회 (저장소 → 메모리) =====

/** 배지 색. 첫 번째 후보의 국가/VPN으로 정한다. */
export type IpCategory = "korea" | "japan" | "china" | "foreign" | "vpn";

interface IpInfo {
    /** 후보를 겹치지 않게 모두 쓰고 한국은 국가를 생략한다. */
    label: string;
    /** label과 같은 후보를 한 줄에 하나씩 (툴팁용). */
    title: string;
    category: IpCategory;
}

let lookupIp: ((ip: string) => IpCandidate[] | undefined) | null = null;
/** uid → 이유 조회. 저장은 갤러리 → uid[]라 뒤집어 두고, 처음 조회할 때 읽기 시작한다. */
let bans: ((uid: string) => string | undefined) | null = null;
let bansRequested = false;
/** 밴 DB 갱신 수. 늦게 끝난 첫 읽기가 새 값을 덮지 않게 견준다. */
let banVersion = 0;
/** 읽어 둔 DB의 버전+형식. bfcache 복원 때 같으면 다시 풀지 않는다. */
let loadedStamp = "";
const stampOf = (meta: DatabaseMeta | null): string => `${meta?.version ?? ""}
${meta?.format ?? ""}`;

// DB를 읽을 때마다 올리는 번호. vanilla 스토어에 둬 React가 배경 번들에 딸려 가지 않게 한다.
const versionStore = createStore(() => 0);

export const databaseVersion = versionStore.getState;
/** DB 변경 구독. 처음 구독할 때 읽기 시작해 읽은 뒤 번호가 올라 다시 그려진다. */
export const subscribeDatabase = (listener: () => void): (() => void) => {
    void initDatabase().catch(console.error);
    return versionStore.subscribe(listener);
};

/** DB 변경 구독. subscribeDatabase와 달리 읽기를 시작하지 않는다. */
export const onDatabaseChange = (listener: () => void): (() => void) => versionStore.subscribe(listener);

const bump = (): void => versionStore.setState((version) => version + 1);

// 깨진 값이면 던지지 않고 IP 정보 없이 둔다(던지면 userinfo setup까지 실패한다).
const loadIp = (stored: string, format: number | undefined): void => {
    lookupIp = null;
    try {
        lookupIp = stored && format === IP_FORMAT ? createIpLookup(parseStoredIpData(stored)) : null;
    } catch (e) {
        console.error("IP DB를 읽지 못했습니다.", e);
    }
    bump();
};

const loadBans = (stored: string): void => {
    bans = indexBans({});
    try {
        bans = indexBans(parseBans(stored));
    } catch (e) {
        console.error("밴 DB를 읽지 못했습니다.", e);
    }
    bump();
};

/** 밴 목록 → uid 조회. uid를 정렬해 한 문자열로 잇고 이진 탐색해 메모리를 줄인다. */
const indexBans = (list: BanList): ((uid: string) => string | undefined) => {
    const reasonsOf = new Map<string, string>();
    for (const [reason, uids] of Object.entries(list)) {
        for (const uid of uids) reasonsOf.set(uid, reasonsOf.has(uid) ? `${reasonsOf.get(uid)}, ${reason}` : reason);
    }

    const uids = [...reasonsOf.keys()].sort();
    // 이유 조합은 uid보다 훨씬 적어 번호로 가리킨다.
    const reasons = [...new Set(reasonsOf.values())];
    const reasonIndex = new Map(reasons.map((reason, index) => [reason, index]));
    // uid i는 joined[starts[i] .. starts[i + 1]) 이다. 구분자 없이 이으므로 uid에 어떤 글자가 있어도 된다.
    const joined = uids.join("");
    const starts = new Uint32Array(uids.length + 1);
    const reasonOf = new Uint32Array(uids.length);
    for (const [index, uid] of uids.entries()) {
        starts[index + 1] = starts[index]! + uid.length;
        reasonOf[index] = reasonIndex.get(reasonsOf.get(uid)!)!;
    }

    return (uid) => {
        // 정렬(sort)과 비교(<)가 같은 UTF-16 코드 단위 순서라 이진 탐색이 맞다.
        let low = 0;
        let high = reasonOf.length - 1;
        while (low <= high) {
            const middle = (low + high) >>> 1;
            const key = joined.slice(starts[middle], starts[middle + 1]);
            if (key === uid) return reasons[reasonOf[middle]!];
            if (key < uid) low = middle + 1;
            else high = middle - 1;
        }
        return undefined;
    };
};

// 감시는 페이지 단위라(모듈이 꺼져도 버블이 쓴다) 무효화 때 releaseDatabase로 푼다.
const watching = new AbortController();

/** DB 감시를 푼다. 파이어폭스는 죽은 인스턴스가 남아 풀지 않으면 DB가 바뀔 때마다 다시 푼다. */
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
        // 이 확장의 배경이 방금 검사하고 쓴 값이다.
        loadIp(next ?? "", IP_FORMAT);
    }, signal);
    const [ip, meta] = await Promise.all([storage.getItem<string>(DB_KEYS.ip, {fallback: ""}), storage.getItem<DatabaseMeta>(DB_META_KEY)]).catch((e: unknown) => {
        attempt.abort();
        throw e;
    });
    if (!updated) {
        loadedStamp = stampOf(meta);
        loadIp(ip, meta?.format);
    }
    // 밴은 한 번이라도 읽었을 때만 새 값을 따라간다.
    watchStorage<string>(DB_KEYS.ban, (next) => {
        if (!bansRequested) return;
        banVersion++;
        loadBans(next ?? "");
    }, signal);
    // bfcache 동안의 갱신은 watch로 오지 않아 복원 때 meta로 검사한다.
    onBfcacheRestore(async () => {
        const meta = await storage.getItem<DatabaseMeta>(DB_META_KEY);
        const stamp = stampOf(meta);
        if (stamp === loadedStamp) return;
        const [ip, ban] = await Promise.all([storage.getItem<string>(DB_KEYS.ip, {fallback: ""}), bansRequested ? storage.getItem<string>(DB_KEYS.ban, {fallback: ""}) : null]);
        loadedStamp = stamp;
        loadIp(ip, meta?.format);
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

/** 괄호 안 표시. VPN이 우선, 한국은 생략. */
const tagOf = ({vpn, country}: IpCandidate): string | undefined => (vpn ? "VPN" : country);

const withTag = (name: string, tag?: string): string => (name && tag ? `${name} (${tag})` : name || tag || "");

/** IP 대역(a.b)의 조직, 국가, VPN 정보. */
export const ipInfoOf = (ip: string): IpInfo | undefined => {
    const candidates = lookupIp?.(ip);
    const first = candidates?.[0];
    if (!candidates || !first) return undefined;

    // 조직이 없으면 국가/VPN만, 그것도 없으면 "조직 미상"으로 빈 칸을 막는다.
    const shown = [...new Set(candidates.map((candidate) => withTag(candidate.org ?? "", tagOf(candidate)) || "조직 미상"))];

    return {label: shown.join(", "), title: shown.join("\n"), category: categoryOf(first)};
};

/** 어느 IP까지 보여 줄지 (userinfo 설정). */
export type IpInfoFilter = "all" | "foreign" | "vpn" | "none";

export const passesIpFilter = ({category}: IpInfo, filter: IpInfoFilter): boolean =>
    filter === "all" || (filter === "foreign" && category !== "korea") || (filter === "vpn" && category === "vpn");

/** 갱차 이유들. 첫 호출이 밴 DB를 읽기 시작한다. */
export const banReasonsOf = (uid: string): string | undefined => {
    if (!bansRequested) {
        bansRequested = true;
        // 감시가 새 값을 먼저 넣었으면 읽은 값은 버린다.
        const version = banVersion;
        void storage.getItem<string>(DB_KEYS.ban, {fallback: ""}).then((stored) => {
            if (banVersion === version) loadBans(stored);
        }, (e: unknown) => {
            bansRequested = false;
            console.error(e);
        });
    }
    return bans?.(uid);
};
