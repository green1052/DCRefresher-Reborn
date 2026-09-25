import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {dbStorage} from "@/core/storage/items";
import type {StoredDB} from "@/core/storage/types";

/** IP(ISP)/갱차 데이터베이스를 내려받아 저장 — 배경(설치·주기)과 옵션 페이지(지금 갱신)에서 호출 */
export const updateDatabase = async (): Promise<void> => {
    const [version, ip, ban] = await Promise.all([
        http.get(urls.database.version).text(),
        http.get(urls.database.ip).json<StoredDB["ip"]>(),
        http.get(urls.database.ban).json<StoredDB["ban"]>()
    ]);

    await dbStorage.setValue({version, lastUpdate: Date.now(), ip, ban});
};

// ===== 콘텐츠 스크립트용 조회 (저장소 → 메모리) =====

let isps: StoredDB["ip"] = {};
/** ban은 이유 → uid[] 형태라 uid → 이유[] 역색인을 만들어 둔다 */
let bans = new Map<string, string[]>();

const load = (db: StoredDB | null): void => {
    isps = db?.ip ?? {};
    bans = new Map();

    for (const [reason, uids] of Object.entries(db?.ban ?? {})) {
        for (const uid of uids) bans.set(uid, [...(bans.get(uid) ?? []), reason]);
    }
};

let initialized: Promise<void> | null = null;

/** 조회용 데이터 로드 + 변경 감시. 여러 번 불러도 1회 */
export const initDatabase = (): Promise<void> =>
    (initialized ??= (async () => {
        load(await dbStorage.getValue());
        dbStorage.watch(load);
    })());

/** IP의 통신사/ISP 이름 */
export const ispOf = (ip: string): string | undefined => isps[ip];

/** 갱신 차단(밴) 이유들. 없으면 undefined */
export const banReasonsOf = (uid: string): string | undefined => bans.get(uid)?.join(", ");
