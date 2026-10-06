import {storage} from "wxt/utils/storage";

import {sendMessage} from "@/core/messaging/protocol";
import {createLimiter} from "@/utils/limit";
import {isRecord} from "@/utils/record";

/**
 * 차단 항목·메모가 마지막으로 쓰인(걸린·보인) 시각. 옵션의 차단·메모 탭이 오래 안 쓰인 항목을 거를 때 쓴다.
 * 기기마다 따로 두고 백업하지 않는다 (core/backup.ts의 isBackupTarget).
 * block은 차단 항목 id, memo는 "종류:대상" 키다.
 * 여러 탭과 옵션 페이지가 함께 고치므로 쓰기는 배경 한 곳에서 차례로 한다 (recordUsage·syncUsage). 따로 읽고 쓰면 그사이 다른 쪽의 기록을 덮는다.
 */
export const USAGE_KEY = "local:refresher:usage";

export type UsageKind = "block" | "memo";
export type UsageData = Record<UsageKind, Record<string, number>>;

/** 한 페이지에서 같은 항목은 이 간격(ms)에 한 번만 적는다. 며칠 단위로 보므로 촘촘할 필요가 없다. */
const RECORD_GAP = 60 * 60 * 1000;
const SEND_DELAY = 5000;

export const memoUsageKey = (type: string, user: string): string => `${type}:${user}`;

const normalizeTimes = (value: unknown): Record<string, number> =>
    isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number")) : {};

const readUsage = async (): Promise<UsageData> => {
    const stored = await storage.getItem<unknown>(USAGE_KEY);
    return isRecord(stored) ? {block: normalizeTimes(stored.block), memo: normalizeTimes(stored.memo)} : {block: {}, memo: {}};
};

// ===== 콘텐츠 스크립트: 쓰인 항목을 모아 배경에 보낸다 =====

const recorded = new Map<string, number>();
let pending: UsageData = {block: {}, memo: {}};
let timer = 0;
let listening = false;

const send = (): void => {
    window.clearTimeout(timer);
    timer = 0;
    const batch = pending;
    pending = {block: {}, memo: {}};
    if (Object.keys(batch.block).length + Object.keys(batch.memo).length > 0) sendMessage("refresher:markUsed", batch).catch(console.error);
};

/** 항목이 쓰였다고 적는다. 모아서 배경에 보낸다. 차단 검사·메모 찾기처럼 자주 불리는 곳에서 불러도 된다. */
export const markUsed = (kind: UsageKind, id: string): void => {
    const now = Date.now();
    const key = `${kind}\u0000${id}`;
    if (now - (recorded.get(key) ?? 0) < RECORD_GAP) return;
    recorded.set(key, now);
    pending[kind][id] = now;

    if (!listening) {
        listening = true;
        // 모으는 사이 페이지를 떠나도 보낸다.
        window.addEventListener("pagehide", send);
    }
    timer ||= window.setTimeout(send, SEND_DELAY);
};

// ===== 배경: 저장소에 차례로 쓴다 =====

const writes = createLimiter(1);

/** 탭이 보낸 기록을 합친다. 더 늦은 시각을 남긴다. */
export const recordUsage = (batch: UsageData): Promise<void> =>
    writes.run(async () => {
        const usage = await readUsage();
        for (const kind of ["block", "memo"] as const) {
            for (const [id, time] of Object.entries(normalizeTimes(batch[kind]))) usage[kind][id] = Math.max(usage[kind][id] ?? 0, time);
        }
        await storage.setItem(USAGE_KEY, usage);
    });

/**
 * 옵션 페이지의 지금 목록에 맞춘다. 기록이 없는 항목(기록을 시작하기 전부터 있었거나 다른 기기·다른 탭에서 새로 온 것)은 지금 쓰인 것으로 두고,
 * 지운 항목의 기록은 버린다. 바뀐 것이 없으면 쓰지 않는다.
 */
export const syncUsage = (kind: UsageKind, ids: readonly string[]): Promise<Record<string, number>> =>
    writes.run(async () => {
        const usage = await readUsage();
        const now = Date.now();
        const times = usage[kind];
        const next = Object.fromEntries(ids.map((id) => [id, Object.hasOwn(times, id) ? times[id]! : now]));
        const changed = ids.some((id) => !Object.hasOwn(times, id)) || Object.keys(times).some((id) => !Object.hasOwn(next, id));

        if (changed) await storage.setItem(USAGE_KEY, {...usage, [kind]: next});
        return next;
    });
