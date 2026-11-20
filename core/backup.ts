/** 클라우드(storage.sync) 백업. 설정을 gzip→base64로 묶어 8KB 조각으로 나눠 한 번에 쓴다 (전체 한도 100KB). */

import MODULE_IDS from "@/.wxt/module-ids";
import {
    BLOCK_DEFAULTS_KEY,
    BLOCK_TYPES,
    backupStorage,
    blockListKey,
    isBlockListKey,
    MEMO_TYPES,
    memoMapKey,
    MODULES_KEY,
    moduleSettingsKey,
    rawKey
} from "@/core/storage/items";
import {friendlyMessage} from "@/utils/error";
import {sha256} from "@/utils/hash";
import {isRecord} from "@/utils/record";

export type BackupSlot = "manual" | "auto";

/** 칸마다 sync 키 이름. 메타는 이 이름, 조각은 `이름:번호`에 둔다. */
const SLOT_KEYS: Record<BackupSlot, string> = {manual: "backup", auto: "autoBackup"};
const chunkKey = (slot: BackupSlot, index: number): string => `${SLOT_KEYS[slot]}:${index}`;
const isSlotKey = (slot: BackupSlot, key: string): boolean => key === SLOT_KEYS[slot] || key.startsWith(`${SLOT_KEYS[slot]}:`);

/** storage.sync 전체 한도 (파이어폭스는 QUOTA_*가 없어 같은 값). */
export const CLOUD_QUOTA = browser.storage.sync.QUOTA_BYTES ?? 102_400;
/** 조각 하나의 글자 수. 항목 한도(8192바이트)에서 키와 따옴표 몫을 뺐다. */
const CHUNK_CHARS = (browser.storage.sync.QUOTA_BYTES_PER_ITEM ?? 8_192) - 192;
/** 전체 한도에서 메타, 키 몫을 뺐다 (두 칸 합계). */
const TOTAL_CHARS = CLOUD_QUOTA - 2400;

/** 이 버전의 백업 형식. */
const FORMAT = 1;

interface BackupMeta {
    /** 형식을 올려도 유지 - 옛 버전이 새 형식 백업도 '있음'으로 보고 덮기 전에 확인하게. */
    format: number;
    chunks: number;
    hash: string;
    /** 압축 후 크기 (base64 글자 수). */
    size: number;
    createdAt: number;
    /** 올린 기기. 옛 버전이 올린 백업에는 없다. */
    device?: string;
}

/** 백업하는 로컬 키 (local: 없이). 모듈 설정은 지금 있는 모듈(MODULE_IDS) 것만 넣는다. */
const BACKUP_KEYS = new Set<string>([
    rawKey(MODULES_KEY),
    rawKey(BLOCK_DEFAULTS_KEY),
    ...BLOCK_TYPES.map((type) => rawKey(blockListKey(type))),
    ...MEMO_TYPES.map((type) => rawKey(memoMapKey(type))),
    ...MODULE_IDS.map((id) => rawKey(moduleSettingsKey(id)))
]);

/** 백업, 내보내기 대상 키: 모듈 on/off와 설정, 차단 목록과 기본 모드, 메모. 나머지(DB, 캐시, 기기 값)는 뺀다. */
export const isBackupTarget = (key: string): boolean => BACKUP_KEYS.has(key);

/** 백업 대상 키(isBackupTarget)의 값만 읽는다. get(null)은 수백 KB짜리 IP, 밴 DB까지 읽는다. */
export const readBackupTargets = async (): Promise<Record<string, unknown>> => {
    const keys = (await browser.storage.local.getKeys()).filter(isBackupTarget);
    return keys.length === 0 ? {} : browser.storage.local.get(keys);
};

/** 백업, 내보내기 대상. 차단 목록의 id(UUID)는 압축이 안 돼 크기를 두 배로 하므로 뺀다(읽는 쪽이 새로 준다). */
export const collectLocalData = async (): Promise<Record<string, unknown>> =>
    Object.fromEntries(
        Object.entries(await readBackupTargets())
            .map(([key, value]) => [
                key,
                // undefined인 id는 JSON에서 빠진다 (결과는 늘 JSON으로 쓰인다).
                Array.isArray(value) && isBlockListKey(key)
                    ? value.map((entry: unknown) => (isRecord(entry) ? {...entry, id: undefined} : entry))
                    : value
            ])
    );

const gzip = (text: string): Promise<Uint8Array<ArrayBuffer>> =>
    new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).bytes();

const gunzip = (bytes: Uint8Array<ArrayBuffer>): Promise<string> =>
    new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();

/** 형식 번호 크기는 따지지 않는다 - 더 높은 형식도 백업이 있는 것으로 보고 읽을 때만 막는다. */
const isMeta = (value: unknown): value is BackupMeta => isRecord(value) && Number.isInteger(value.format) && Number.isInteger(value.chunks);

const backupToCloud = async (slot: BackupSlot): Promise<void> => {
    const bytes = await gzip(JSON.stringify(await collectLocalData()));
    const encoded = bytes.toBase64();

    // get(null)은 두 칸의 base64 조각(최대 100KB)까지 끌어온다. 여기선 다른 칸의 메타와 이 칸의 키 목록만 있으면 된다.
    const otherKey = SLOT_KEYS[slot === "manual" ? "auto" : "manual"];
    const other = (await browser.storage.sync.get(otherKey))[otherKey];
    const otherSize = isMeta(other) ? other.size : 0;
    if (encoded.length + otherSize > TOTAL_CHARS) {
        const kb = (chars: number): number => Math.ceil(chars / 1024);
        throw new Error(`백업이 클라우드 한도를 넘습니다. (이번 ${kb(encoded.length)}KB + 다른 백업 ${kb(otherSize)}KB / ${Math.floor(TOTAL_CHARS / 1024)}KB)`);
    }

    const chunks: string[] = [];
    for (let at = 0; at < encoded.length; at += CHUNK_CHARS) chunks.push(encoded.slice(at, at + CHUNK_CHARS));

    const meta: BackupMeta = {format: FORMAT, chunks: chunks.length, hash: await sha256(bytes), size: encoded.length, createdAt: Date.now(), device: await backupStorage.device().getValue()};
    const items: Record<string, unknown> = {
        ...Object.fromEntries(chunks.map((chunk, index) => [chunkKey(slot, index), chunk])),
        [SLOT_KEYS[slot]]: meta
    };

    // 이 칸에서 이번에 쓰지 않는 조각(전보다 줄어든 몫)은 쓴 뒤에 지운다. 쓰기가 실패하면 이전 메타가 여전히 그 조각을 가리킨다.
    const stale = (await browser.storage.sync.getKeys()).filter((key) => !(key in items) && isSlotKey(slot, key));
    await browser.storage.sync.set(items);
    // 지우기 전에 이 칸의 메타가 아직 이번 백업인지 다시 본다. 그사이 다른 기기가 새 백업을 올렸으면 그 백업이 쓴 조각을 지워 깨진다.
    const current = (await browser.storage.sync.get(SLOT_KEYS[slot]))[SLOT_KEYS[slot]];
    const stillMine = isMeta(current) && current.createdAt === meta.createdAt && current.hash === meta.hash;
    // 지우기가 실패해도(쓰기 한도 등) 백업은 이미 끝났다. 남은 조각은 다음 백업이 덮거나 지운다.
    if (stale.length > 0 && stillMine) await browser.storage.sync.remove(stale).catch((e: unknown) => void console.warn("오래된 백업 조각을 지우지 못했습니다:", e));
};

interface SlotStatus {
    createdAt: number;
    size: number;
    /** 다른 기기가 올렸다 (기기 표시 없는 옛 백업 포함). */
    other: boolean;
}

export interface CloudBackupStatus {
    manual?: SlotStatus;
    auto?: SlotStatus;
}

/** 클라우드 백업 상태. 다른 기기가 올린 백업도 메타로 알 수 있다. */
export const readCloudBackupStatus = async (): Promise<CloudBackupStatus> => {
    // 메타 두 개만 읽는다. get(null)은 base64 조각까지 끌어온다.
    const metas = await browser.storage.sync.get(Object.values(SLOT_KEYS));
    const device = await backupStorage.device().getValue();
    const slotStatus = (slot: BackupSlot): SlotStatus | undefined => {
        const meta = metas[SLOT_KEYS[slot]];
        return isMeta(meta) ? {createdAt: meta.createdAt, size: meta.size, other: meta.device !== device} : undefined;
    };

    return {
        manual: slotStatus("manual"),
        auto: slotStatus("auto")
    };
};

/** 두 칸의 백업을 모두 지운다. v5가 sync에 올려 둔 키도 지워 한도 초과를 푼다. */
export const clearCloudBackups = (): Promise<void> => browser.storage.sync.clear();

interface CloudBackup {
    data: Record<string, unknown>;
    createdAt: number;
}

/** 한 칸의 백업을 읽는다. */
export const readCloudBackup = async (slot: BackupSlot): Promise<CloudBackup | null> => {
    // 메타를 먼저 읽고 이 칸의 조각만 읽는다. get(null)은 다른 칸의 조각까지 끌어온다.
    const meta = (await browser.storage.sync.get(SLOT_KEYS[slot]))[SLOT_KEYS[slot]];

    if (!isMeta(meta)) return null;
    if (meta.format > FORMAT) throw new Error("새 버전 확장에서 만든 백업입니다. 확장을 업데이트해 주세요.");

    const keys = Array.from({length: meta.chunks}, (_, index) => chunkKey(slot, index));
    const stored = await browser.storage.sync.get(keys);
    const chunks = keys.map((key) => stored[key]);
    if (chunks.some((chunk) => typeof chunk !== "string")) {
        throw new Error("백업 조각이 빠져 있습니다. 다른 기기에서 동기화가 아직 끝나지 않았을 수 있습니다.");
    }

    let bytes: Uint8Array<ArrayBuffer> | undefined;
    try {
        bytes = Uint8Array.fromBase64(chunks.join(""));
    } catch {}
    // 새 메타만 먼저 동기화되고 조각은 아직 이전 백업이어도 여기서 어긋난다. 조각 수가 늘었으면 옛 마지막 조각의 '='가 가운데 끼어 디코딩부터 실패한다.
    if (!bytes || (await sha256(bytes)) !== meta.hash) throw new Error("백업 데이터가 맞지 않습니다. 다른 기기에서 동기화가 아직 끝나지 않았을 수 있습니다.");

    const data: unknown = JSON.parse(await gunzip(bytes));
    if (!isRecord(data)) throw new Error("백업 데이터가 손상되었습니다.");
    return {data, createdAt: meta.createdAt};
};

/** 백업하고 실패 이유를 남긴다 (성공하면 지운다). */
export const runBackup = async (slot: BackupSlot): Promise<void> => {
    try {
        await backupToCloud(slot);
        await backupStorage.error().setValue("");
    } catch (e) {
        console.error("백업하지 못했습니다.", e);
        await backupStorage.error().setValue(friendlyMessage(e));
        throw e;
    }
};
