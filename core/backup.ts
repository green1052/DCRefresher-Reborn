/**
 * 클라우드(storage.sync) 백업 — 수동 백업과 자동 백업을 따로 둔다.
 *
 * storage.sync 한도: 항목당 8KB(키 + JSON 값), 전체 100KB, 쓰기 분당 120회.
 * 설정을 통째로 gzip → base64로 묶어 8KB 이하 조각(<칸>:0, <칸>:1, …)으로 나누고,
 * 조각 수와 해시를 담은 <칸> 키와 함께 set 한 번으로 쓴다 — 실패해도 이전 백업이 그대로 남는다.
 */
import {backupStorage} from "@/core/storage/items";

export type BackupSlot = "manual" | "auto";

/** 칸마다 sync 키 이름 — 메타는 이 이름, 조각은 `이름:번호` */
const SLOT_KEYS: Record<BackupSlot, string> = {manual: "backup", auto: "autoBackup"};
const chunkKey = (slot: BackupSlot, index: number): string => `${SLOT_KEYS[slot]}:${index}`;
const isSlotKey = (slot: BackupSlot, key: string): boolean => key === SLOT_KEYS[slot] || key.startsWith(`${SLOT_KEYS[slot]}:`);
const SLOTS = Object.keys(SLOT_KEYS) as BackupSlot[];

/** 조각 하나의 글자 수 — 항목 한도 8192바이트에서 키와 따옴표 몫을 뺐다 */
const CHUNK_CHARS = 8000;
/** 전체 한도 102400바이트에서 메타·키 몫을 뺐다 (두 칸 합계) */
const TOTAL_CHARS = 100_000;

interface BackupMeta {
    format: 1;
    chunks: number;
    /** 압축 데이터의 SHA-256 (hex) */
    hash: string;
    /** 압축 후 크기 (base64 글자 수) */
    size: number;
    createdAt: number;
}

/** 모듈 캐시 키 (refresher:module:<id>:data) */
export const isModuleDataKey = (key: string): boolean => /^refresher:module:.+:data$/.test(key);

/**
 * 백업·내보내기에서 빼는 로컬 키
 * - refresher:db: IP/밴 DB — 크고, 다시 받으면 된다
 * - refresher:backup:*: 백업 상태 자체
 * - refresher:module:*:data: 모듈 캐시(글댓비 등) — 계속 불어난다
 * - refresher:nonmember: 비회원 비밀번호(평문) — 내보내기 JSON을 남에게 건네거나 sync에 올리면 새어 나간다
 */
export const isBackupTarget = (key: string): boolean =>
    key !== "refresher:db" && key !== "refresher:nonmember" && !key.startsWith("refresher:backup:") && !isModuleDataKey(key);

export const collectLocalData = async (): Promise<Record<string, unknown>> => {
    const data = (await browser.storage.local.get(null)) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(data).filter(([key]) => isBackupTarget(key)));
};

const gzip = async (text: string): Promise<Uint8Array> =>
    new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());

const gunzip = (bytes: Uint8Array): Promise<string> =>
    new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"))).text();

const sha256 = async (bytes: Uint8Array): Promise<string> =>
    [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource))].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const isMeta = (value: unknown): value is BackupMeta =>
    typeof value === "object" && value !== null && (value as BackupMeta).format === 1 && Number.isInteger((value as BackupMeta).chunks);

/** 예전(v5) 방식으로 통째로 넣어 둔 설정 키 — 어느 칸에도 속하지 않는 키 */
const isLegacyKey = (key: string): boolean => !SLOTS.some((slot) => isSlotKey(slot, key));

/** 설정을 클라우드의 한 칸에 백업 */
const backupToCloud = async (slot: BackupSlot): Promise<void> => {
    const bytes = await gzip(JSON.stringify(await collectLocalData()));
    const encoded = bytes.toBase64();

    const all = (await browser.storage.sync.get(null)) as Record<string, unknown>;
    const other = all[SLOT_KEYS[slot === "manual" ? "auto" : "manual"]];
    const otherSize = isMeta(other) ? other.size : 0;
    if (encoded.length + otherSize > TOTAL_CHARS) {
        const kb = (chars: number): number => Math.ceil(chars / 1024);
        throw new Error(`백업이 클라우드 한도를 넘습니다. (이번 ${kb(encoded.length)}KB + 다른 백업 ${kb(otherSize)}KB / 100KB)`);
    }

    const chunks: string[] = [];
    for (let at = 0; at < encoded.length; at += CHUNK_CHARS) chunks.push(encoded.slice(at, at + CHUNK_CHARS));

    const meta: BackupMeta = {format: 1, chunks: chunks.length, hash: await sha256(bytes), size: encoded.length, createdAt: Date.now()};
    const items: Record<string, unknown> = {
        ...Object.fromEntries(chunks.map((chunk, index) => [chunkKey(slot, index), chunk])),
        [SLOT_KEYS[slot]]: meta
    };

    // 이번에 쓰지 않는 키 — 이 칸에서 전보다 줄어든 조각. 다른 칸은 건드리지 않는다
    // 예전 방식 설정은 수동 칸으로 복원되므로 수동 칸을 쓸 때만 치운다
    const stale = Object.keys(all).filter((key) => !(key in items) && (isSlotKey(slot, key) || (slot === "manual" && isLegacyKey(key))));

    try {
        await browser.storage.sync.set(items);
    } catch (e) {
        // 예전 방식 백업이 자리를 차지해 한도를 넘었을 수 있다 — 그것만 치우고 한 번 더
        // 이 칸의 남는 조각은 성공한 뒤에 지운다 — 다시 실패하면 이전 메타가 그 조각을 가리킨다
        const legacy = stale.filter(isLegacyKey);
        if (legacy.length === 0) throw e;
        await browser.storage.sync.remove(legacy);
        await browser.storage.sync.set(items);
    }

    if (stale.length > 0) await browser.storage.sync.remove(stale);
};

/** 칸마다 마지막 백업 시각 (없으면 undefined). 예전 방식 백업이 남아 있으면 legacy: true */
export const readCloudBackupTimes = async (): Promise<{ manual?: number; auto?: number; legacy: boolean }> => {
    const all = (await browser.storage.sync.get(null)) as Record<string, unknown>;
    const time = (slot: BackupSlot): number | undefined => {
        const meta = all[SLOT_KEYS[slot]];
        return isMeta(meta) ? meta.createdAt : undefined;
    };

    return {manual: time("manual"), auto: time("auto"), legacy: Object.keys(all).some((key) => isLegacyKey(key) && isBackupTarget(key))};
};

interface CloudBackup {
    data: Record<string, unknown>;
    /** 예전 방식 백업이면 없음 */
    createdAt?: number;
}

/** 한 칸의 백업 읽기. 없으면 null — 수동 칸은 예전 방식 백업도 읽는다 */
export const readCloudBackup = async (slot: BackupSlot): Promise<CloudBackup | null> => {
    const all = (await browser.storage.sync.get(null)) as Record<string, unknown>;
    const meta = all[SLOT_KEYS[slot]];

    if (isMeta(meta)) {
        const chunks = Array.from({length: meta.chunks}, (_, index) => all[chunkKey(slot, index)]);
        if (chunks.some((chunk) => typeof chunk !== "string")) {
            throw new Error("백업 조각이 빠져 있습니다. 다른 기기에서 동기화가 아직 끝나지 않았을 수 있습니다.");
        }

        const bytes = Uint8Array.fromBase64(chunks.join(""));
        if ((await sha256(bytes)) !== meta.hash) throw new Error("백업 데이터가 손상됐습니다.");

        return {data: JSON.parse(await gunzip(bytes)) as Record<string, unknown>, createdAt: meta.createdAt};
    }

    if (slot !== "manual") return null;

    // 예전 방식: 로컬 설정을 그대로 sync에 넣었다 (메타보다 먼저 동기화된 조각은 빼고)
    const legacy = Object.fromEntries(Object.entries(all).filter(([key]) => isLegacyKey(key) && isBackupTarget(key)));
    return Object.keys(legacy).length > 0 ? {data: legacy} : null;
};

/** 백업하고 실패 이유를 남긴다 (성공하면 지운다) */
export const runBackup = async (slot: BackupSlot): Promise<void> => {
    try {
        await backupToCloud(slot);
        await backupStorage.error.setValue("");
    } catch (e) {
        await backupStorage.error.setValue(e instanceof Error ? e.message : String(e));
        throw e;
    }
};
