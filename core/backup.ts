/**
 * 클라우드(storage.sync) 백업. 수동 백업과 자동 백업을 따로 둔다.
 *
 * storage.sync 한도: 항목당 8KB(키 + JSON 값), 전체 100KB, 쓰기 분당 120회.
 * 설정을 통째로 gzip → base64로 묶어 8KB 이하 조각(<칸>:0, <칸>:1, …)으로 나누고,
 * 조각 수와 해시를 담은 <칸> 키와 함께 set 한 번으로 쓴다. 쓰기가 실패하면 이전 백업이 그대로 남는다.
 */
import {objectKeys} from "ts-extras";

import {backupStorage, isBlockListKey, isModuleDataKey} from "@/core/storage/items";
import {friendlyMessage} from "@/utils/error";
import {isRecord} from "@/utils/record";

export type BackupSlot = "manual" | "auto";

/** 칸마다 sync 키 이름. 메타는 이 이름, 조각은 `이름:번호`에 둔다 */
const SLOT_KEYS: Record<BackupSlot, string> = {manual: "backup", auto: "autoBackup"};
const chunkKey = (slot: BackupSlot, index: number): string => `${SLOT_KEYS[slot]}:${index}`;
const isSlotKey = (slot: BackupSlot, key: string): boolean => key === SLOT_KEYS[slot] || key.startsWith(`${SLOT_KEYS[slot]}:`);
const SLOTS = objectKeys(SLOT_KEYS);

/** 조각 하나의 글자 수. 항목 한도 8192바이트에서 키와 따옴표 몫을 뺐다 */
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

/**
 * 백업·내보내기에서 빼는 로컬 키
 * - refresher:db:*: IP/밴 DB. 크고 다시 받으면 된다 (refresher:db는 6.0.0 개발판의 한 키짜리)
 * - refresher:backup:*: 백업 상태 자체
 * - refresher:module:*:data: 모듈 캐시(글댓비 등). 계속 불어난다
 */
export const isBackupTarget = (key: string): boolean =>
    key !== "refresher:db" && !key.startsWith("refresher:db:") && !key.startsWith("refresher:backup:") && !isModuleDataKey(key);

/**
 * 백업·내보내기 대상. 차단 목록의 id(UUID)는 압축이 안 돼 클라우드 백업을 두 배 넘게 불리므로 뺀다.
 * 읽는 쪽(stores/blocks의 normalizeBlockList)이 없는 id를 새로 준다.
 */
export const collectLocalData = async (): Promise<Record<string, unknown>> => {
    // get(null)은 수백 KB짜리 IP·밴 DB까지 읽으니 백업할 키만 읽는다. getKeys가 없는 브라우저는 다 읽고 아래에서 거른다
    const keys = typeof browser.storage.local.getKeys === "function" ? (await browser.storage.local.getKeys()).filter(isBackupTarget) : null;
    if (keys?.length === 0) return {};
    const data = await browser.storage.local.get(keys);
    return Object.fromEntries(
        Object.entries(data)
            .filter(([key]) => isBackupTarget(key))
            .map(([key, value]) => [
                key,
                // undefined인 id는 JSON에서 빠진다 (결과는 늘 JSON으로 쓰인다)
                Array.isArray(value) && isBlockListKey(key)
                    ? value.map((entry: unknown) => (isRecord(entry) ? {...entry, id: undefined} : entry))
                    : value
            ])
    );
};

const gzip = (text: string): Promise<Uint8Array<ArrayBuffer>> =>
    new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).bytes();

const gunzip = (bytes: Uint8Array<ArrayBuffer>): Promise<string> =>
    new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();

const sha256 = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)).toHex();

const isMeta = (value: unknown): value is BackupMeta => isRecord(value) && value.format === 1 && Number.isInteger(value.chunks);

/** v5 방식 백업의 키. v5는 로컬 설정을 그대로 sync에 넣었으므로 어느 칸에도 속하지 않는 키로 가려낸다 */
const isLegacyKey = (key: string): boolean => !SLOTS.some((slot) => isSlotKey(slot, key));

/** 설정을 클라우드의 한 칸에 백업 */
const backupToCloud = async (slot: BackupSlot): Promise<void> => {
    const bytes = await gzip(JSON.stringify(await collectLocalData()));
    const encoded = bytes.toBase64();

    const all = await browser.storage.sync.get(null);
    const other = all[SLOT_KEYS[slot === "manual" ? "auto" : "manual"]];
    const otherSize = isMeta(other) ? other.size : 0;
    if (encoded.length + otherSize > TOTAL_CHARS) {
        const kb = (chars: number): number => Math.ceil(chars / 1024);
        throw new Error(`백업이 클라우드 한도를 넘습니다. (이번 ${kb(encoded.length)}KB + 다른 백업 ${kb(otherSize)}KB / ${Math.floor(TOTAL_CHARS / 1024)}KB)`);
    }

    const chunks: string[] = [];
    for (let at = 0; at < encoded.length; at += CHUNK_CHARS) chunks.push(encoded.slice(at, at + CHUNK_CHARS));

    const meta: BackupMeta = {format: 1, chunks: chunks.length, hash: await sha256(bytes), size: encoded.length, createdAt: Date.now()};
    const items: Record<string, unknown> = {
        ...Object.fromEntries(chunks.map((chunk, index) => [chunkKey(slot, index), chunk])),
        [SLOT_KEYS[slot]]: meta
    };

    // 지울 키: 이 칸에서 이번에 쓰지 않는 조각(전보다 줄어든 몫). 다른 칸은 건드리지 않는다.
    // v5 방식 백업은 수동 칸으로 복원되므로 수동 칸을 쓸 때만 치운다.
    const stale = Object.keys(all).filter((key) => !(key in items) && (isSlotKey(slot, key) || (slot === "manual" && isLegacyKey(key))));

    try {
        await browser.storage.sync.set(items);
    } catch (e) {
        // v5 방식 백업이 공간을 차지해 한도를 넘었을 수 있으니 그것만 치우고 한 번 더 쓴다.
        // 이 칸의 남는 조각은 성공한 뒤에 지운다. 다시 실패하면 이전 메타가 여전히 그 조각을 가리키기 때문이다.
        const legacy = stale.filter(isLegacyKey);
        if (legacy.length === 0) {
            // 자동 칸은 v5 방식 백업을 치우지 않는다 (수동 칸으로 복원되는 데이터다). 그것이 원인일 수 있으니 해결 방법을 알린다
            if (Object.keys(all).some(isLegacyKey)) {
                throw new Error(`${friendlyMessage(e)} 예전 방식(v5) 백업이 클라우드 공간을 차지하고 있습니다. 수동 백업을 한 번 하면 정리됩니다.`, {cause: e});
            }
            throw e;
        }
        await browser.storage.sync.remove(legacy);
        await browser.storage.sync.set(items);
    }

    if (stale.length > 0) await browser.storage.sync.remove(stale);
};

/** storage.sync 전체 한도 (바이트) */
export const CLOUD_QUOTA = 102_400;

export interface CloudBackupStatus {
    /** 칸마다 마지막 백업 시각과 크기(바이트). 백업이 없으면 없다 */
    manual?: { createdAt: number; size: number };
    auto?: { createdAt: number; size: number };
    /** v5 방식 백업이 남아 있다 */
    legacy: boolean;
    /** sync 전체 사용량 (바이트). 브라우저가 한도에 쓰는 getBytesInUse 값 */
    used: number;
}

/** 클라우드 백업 상태. 다른 기기가 올린 백업도 메타로 알 수 있다 */
export const readCloudBackupStatus = async (): Promise<CloudBackupStatus> => {
    const [all, used] = await Promise.all([browser.storage.sync.get(null), browser.storage.sync.getBytesInUse(null)]);
    const slotStatus = (slot: BackupSlot): CloudBackupStatus["manual"] => {
        const meta = all[SLOT_KEYS[slot]];
        return isMeta(meta) ? {createdAt: meta.createdAt, size: meta.size} : undefined;
    };

    return {
        manual: slotStatus("manual"),
        auto: slotStatus("auto"),
        legacy: Object.keys(all).some((key) => isLegacyKey(key) && isBackupTarget(key)),
        used
    };
};

interface CloudBackup {
    data: Record<string, unknown>;
    /** v5 방식 백업이면 없음 */
    createdAt?: number;
}

/** 한 칸의 백업을 읽는다. 없으면 null. 수동 칸은 v5 방식 백업도 읽는다 */
export const readCloudBackup = async (slot: BackupSlot): Promise<CloudBackup | null> => {
    const all = await browser.storage.sync.get(null);
    const meta = all[SLOT_KEYS[slot]];

    if (isMeta(meta)) {
        const chunks = Array.from({length: meta.chunks}, (_, index) => all[chunkKey(slot, index)]);
        if (chunks.some((chunk) => typeof chunk !== "string")) {
            throw new Error("백업 조각이 빠져 있습니다. 다른 기기에서 동기화가 아직 끝나지 않았을 수 있습니다.");
        }

        const bytes = Uint8Array.fromBase64(chunks.join(""));
        if ((await sha256(bytes)) !== meta.hash) throw new Error("백업 데이터가 손상되었습니다.");

        const data: unknown = JSON.parse(await gunzip(bytes));
        if (!isRecord(data)) throw new Error("백업 데이터가 손상되었습니다.");
        return {data, createdAt: meta.createdAt};
    }

    if (slot !== "manual") return null;

    // v5 방식: 로컬 설정이 그대로 들어 있다. 메타보다 먼저 동기화된 새 방식 조각은 isLegacyKey가 걸러 낸다
    const legacy = Object.fromEntries(Object.entries(all).filter(([key]) => isLegacyKey(key) && isBackupTarget(key)));
    return Object.keys(legacy).length > 0 ? {data: legacy} : null;
};

/** 백업하고 실패 이유를 남긴다 (성공하면 지운다). 남긴 이유는 데이터 탭에 그대로 보이므로 원문은 콘솔에만 둔다 */
export const runBackup = async (slot: BackupSlot): Promise<void> => {
    try {
        await backupToCloud(slot);
        await backupStorage.error.setValue("");
    } catch (e) {
        console.error("백업하지 못했습니다.", e);
        await backupStorage.error.setValue(friendlyMessage(e));
        throw e;
    }
};
