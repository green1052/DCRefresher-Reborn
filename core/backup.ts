/**
 * 클라우드(storage.sync) 백업.
 *
 * storage.sync 한도: 항목당 8KB(키 + JSON 값), 전체 100KB, 쓰기 분당 120회.
 * 설정을 통째로 gzip → base64로 묶어 8KB 이하 조각(backup:0, backup:1, …)으로 나누고,
 * 조각 수와 해시를 담은 backup 키와 함께 set 한 번으로 쓴다 — 실패해도 이전 백업이 그대로 남는다.
 */
import {backupStorage} from "@/core/storage/items";

const META_KEY = "backup";
const chunkKey = (index: number): string => `backup:${index}`;
/** 조각 하나의 글자 수 — 항목 한도 8192바이트에서 키와 따옴표 몫을 뺐다 */
const CHUNK_CHARS = 8000;
/** 전체 한도 102400바이트에서 메타·키 몫을 뺐다 */
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
 * - refresher:db: IP/밴 DB — 크고, 다시 받으면 된다
 * - refresher:backup:*: 백업 상태 자체
 * - refresher:module:*:data: 모듈 캐시(글댓비 등) — 계속 불어난다
 */
export const isBackupTarget = (key: string): boolean =>
    key !== "refresher:db" && !key.startsWith("refresher:backup:") && !/^refresher:module:.+:data$/.test(key);

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

/** 지금 설정을 클라우드에 백업 */
export const backupToCloud = async (): Promise<BackupMeta> => {
    const bytes = await gzip(JSON.stringify(await collectLocalData()));
    const encoded = bytes.toBase64();
    if (encoded.length > TOTAL_CHARS) {
        throw new Error(`백업이 클라우드 한도를 넘습니다. (${Math.ceil(encoded.length / 1024)}KB / 100KB)`);
    }

    const chunks: string[] = [];
    for (let at = 0; at < encoded.length; at += CHUNK_CHARS) chunks.push(encoded.slice(at, at + CHUNK_CHARS));

    const meta: BackupMeta = {format: 1, chunks: chunks.length, hash: await sha256(bytes), size: encoded.length, createdAt: Date.now()};
    const items: Record<string, unknown> = {...Object.fromEntries(chunks.map((chunk, index) => [chunkKey(index), chunk])), [META_KEY]: meta};

    // 이번에 쓰지 않는 키 — 전보다 줄어든 조각, 예전(v5) 방식으로 통째로 넣어 둔 설정
    const stale = Object.keys(await browser.storage.sync.get(null)).filter((key) => !(key in items));

    try {
        await browser.storage.sync.set(items);
    } catch (error) {
        // 예전 방식 백업이 자리를 차지해 한도를 넘었을 수 있다 — 치우고 한 번 더
        if (stale.length === 0) throw error;
        await browser.storage.sync.remove(stale);
        await browser.storage.sync.set(items);
        return meta;
    }

    if (stale.length > 0) await browser.storage.sync.remove(stale);
    return meta;
};

export interface CloudBackup {
    data: Record<string, unknown>;
    /** 예전 방식 백업이면 없음 */
    createdAt?: number;
}

/** 클라우드 백업 읽기. 없으면 null */
export const readCloudBackup = async (): Promise<CloudBackup | null> => {
    const all = (await browser.storage.sync.get(null)) as Record<string, unknown>;
    const meta = all[META_KEY];

    if (isMeta(meta)) {
        const chunks = Array.from({length: meta.chunks}, (_, index) => all[chunkKey(index)]);
        if (chunks.some((chunk) => typeof chunk !== "string")) {
            throw new Error("백업 조각이 빠져 있습니다. 다른 기기에서 동기화가 아직 끝나지 않았을 수 있습니다.");
        }

        const bytes = Uint8Array.fromBase64(chunks.join(""));
        if ((await sha256(bytes)) !== meta.hash) throw new Error("백업 데이터가 손상됐습니다.");

        return {data: JSON.parse(await gunzip(bytes)) as Record<string, unknown>, createdAt: meta.createdAt};
    }

    // 예전 방식: 로컬 설정을 그대로 sync에 넣었다 (메타보다 먼저 동기화된 조각은 빼고)
    const legacy = Object.fromEntries(
        Object.entries(all).filter(([key]) => key !== META_KEY && !key.startsWith("backup:") && isBackupTarget(key))
    );
    return Object.keys(legacy).length > 0 ? {data: legacy} : null;
};

/** 백업하고 결과(시각·오류)를 남긴다 — 수동 백업과 자동 백업이 같이 쓴다 */
export const runBackup = async (): Promise<void> => {
    try {
        const meta = await backupToCloud();
        await backupStorage.lastUpdate.setValue(meta.createdAt);
        await backupStorage.error.setValue("");
    } catch (error) {
        await backupStorage.error.setValue(error instanceof Error ? error.message : String(error));
        throw error;
    }
};
