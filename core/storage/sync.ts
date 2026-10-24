import pLimit from "p-limit";
import {storage, type StorageItemKey} from "wxt/utils/storage";

import {onBfcacheRestore} from "@/utils/dom";
import {saveOrReload} from "@/utils/error";
import {once} from "@/utils/once";
import {isRecord} from "@/utils/record";
import {objectKeys} from "@/utils/typed";

/**
 * storage.watch를 signal이 끝날 때 푼다. 파이어폭스에서 스크립트가 다시 주입되면 죽은 인스턴스가 남아 감시 콜백을 계속 받으므로
 * 콘텐츠 스크립트 쪽 감시는 컨텍스트의 signal에 묶는다. 돌려준 함수로 먼저 풀 수도 있다.
 */
export const watchStorage = <T>(key: StorageItemKey, callback: (next: T | null, previous: T | null) => void, signal?: AbortSignal): (() => void) => {
    // await 뒤에 거는 감시는 그사이 컨텍스트가 끝났을 수 있다. 끝난 signal에는 abort가 다시 오지 않아 걸면 풀 길이 없다.
    if (signal?.aborted) return () => {};
    const unwatch = storage.watch<T>(key, callback);
    const dispose = (): void => {
        // 확장이 무효화된 뒤에는 storage.onChanged.removeListener가 던지고, 리스너도 이미 죽었다.
        if (browser.runtime?.id) unwatch();
    };
    signal?.addEventListener("abort", dispose, {once: true});
    return dispose;
};

/** 키 여러 개를 storage.getItems 한 번으로 읽는다. getItems는 받은 키로 값을 돌려주지만 순서는 약속이 아니므로 키로 짝짓는다. */
export const readItems = async (keys: readonly StorageItemKey[]): Promise<Map<StorageItemKey, unknown>> =>
    new Map((await storage.getItems([...keys])).map(({key, value}) => [key, value]));

/**
 * 저장소 키 여러 개를 한 번의 storage.local.get으로 읽어 apply에 넘기고, 바뀌면(다른 탭·옵션 페이지·이 탭의 쓰기) 다시 넘긴다.
 * 항목(defineItem)은 만드는 순간 키마다 한 번 더 읽으므로 키로 읽고 감시한다 (core/storage/items.ts). 값이 없으면 null이다.
 * - load: 다시 읽는다 (저장 실패 뒤 되돌리기 등).
 * - start: 감시를 걸고 읽는다. 여러 번 불러도 한 번만 한다. 옛 값으로 쓰면 다른 탭의 변경을 덮으므로 bfcache에서 돌아오면 다시 읽는다.
 *   signal(콘텐츠 스크립트 컨텍스트의 것)이 끝나면 감시를 푼다.
 * - save: 스토어에 먼저 반영해 둔 쓰기를 저장한다. 실패하면 다시 읽고 던진다 (saveOrReload).
 *   쓰기가 남아 있는 동안은 apply하지 않는다. 앞 쓰기의 값이 돌아오면 뒤 쓰기를 미리 반영해 둔 스토어를 앞 값으로 되돌려
 *   화면이 잠깐 튄다. 남은 쓰기가 끝나면 한 번 읽어 그사이 다른 탭이 쓴 값까지 맞춘다.
 */
export const storageSync = <K extends StorageItemKey>(keys: readonly K[], onChange: (key: K, value: unknown) => void) => {
    let pending = 0;
    const apply = (key: K, value: unknown): void => {
        if (pending === 0) onChange(key, value);
    };

    const load = async (): Promise<void> => {
        const items = await readItems(keys);
        for (const key of keys) apply(key, items.get(key) ?? null);
    };

    const start = once(async (signal?: AbortSignal): Promise<void> => {
        // 감시를 먼저 건다. 읽은 뒤에 걸면 읽는 사이 다른 탭이 쓴 값을 놓치고, 그 옛 값으로 저장하면 그 변경을 덮는다.
        // 읽는 사이 바뀐 키는 읽은 값(바뀌기 전일 수 있다)을 넣지 않는다.
        const changed = new Set<K>();
        const unwatches = keys.map((key) => watchStorage(key, (next) => {
            changed.add(key);
            apply(key, next);
        }, signal));
        try {
            const items = await readItems(keys);
            for (const key of keys) if (!changed.has(key)) apply(key, items.get(key) ?? null);
        } catch (e) {
            // once가 다음 호출에 다시 시도한다. 그때 감시가 두 번 걸리지 않게 푼다.
            for (const unwatch of unwatches) unwatch();
            throw e;
        }
        onBfcacheRestore(load, signal);
    });

    const save = async (write: () => Promise<void>, failure: string): Promise<void> => {
        pending++;
        // write을 Promise에 실어 보낸다. 동기적으로 던지면 finally가 돌지 않아 pending이 영원히 남고,
        // apply가 저장소 변경을 더 이상 넣지 않아 그 탭의 동기화가 조용히 멈춘다.
        // 줄이고 나서 되돌린다. 남은 쓰기가 없어야 되돌린 값이 들어간다.
        await saveOrReload(Promise.resolve().then(write).finally(() => pending--), load, failure);
        // 저장은 됐다. 다시 읽지 못해도 스토어는 이미 저장한 값을 들고 있다.
        if (pending === 0) await load().catch(console.error);
    };

    return {load, start, save};
};

/** 객체 키를 정렬해 직렬화한다. 크롬 저장소는 키를 정렬해 돌려주므로, 그대로 비교하면 이 탭이 쓴 값이 돌아올 때 다른 값이 된다. */
const canonical = (value: unknown): string =>
    JSON.stringify(value, (_key, item: unknown) => (isRecord(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item));

/** 항목 수. 수가 다르면 직렬화해 볼 것도 없이 다른 값이다 (목록이 수천 개면 canonical이 탭마다 몇 ms 걸린다). */
const sizeOf = (value: unknown): number | undefined => (Array.isArray(value) ? value.length : isRecord(value) ? Object.keys(value).length : undefined);

/**
 * 유형마다 키 하나에 저장하는 목록(차단 목록·메모)을 스토어와 양방향으로 맞춘다.
 * - update: 스토어에 먼저 반영하고 저장한다. 실패하면 저장소 값으로 되돌리고 던진다 (saveOrReload).
 * - 저장소가 바뀌면(다른 탭·옵션 페이지, 이 탭의 쓰기도 돌아온다) normalize한 값을 넣는다. 값이 같으면 스토어를 건드리지 않아 구독자를 깨우지 않는다.
 * - extra: 같은 읽기·감시에 함께 묶을 다른 키 (차단의 기본 모드 등).
 * load·start는 storageSync와 같다. 이 탭의 쓰기가 남아 있는 동안 돌아오는 값은 넣지 않는다 (storageSync의 save).
 */
export const typedListSync = <T extends string, V>(options: {
    types: readonly T[];
    keyOf: (type: T) => StorageItemKey;
    normalize: (value: unknown) => V;
    get: () => Record<T, V>;
    set: (lists: Record<T, V>) => void;
    /** 저장하지 못했을 때 콘솔에 남길 문구. */
    failure: string;
    extra?: Partial<Record<StorageItemKey, (value: unknown) => void>>;
    /**
     * Web Locks 이름. 목록 쓰기는 읽고-고쳐-쓰기라 여러 창이 동시에 쓰면 앞의 쓰기를 덮는다.
     * 잠금은 같은 출처끼리만 서진다: 옵션↔팝업(확장 출처)끼리와 디시 탭끼리는 서진다.
     * 디시 탭과 옵션·팝업 사이는 출처가 달라 서지 않는다 — 교차 출처 쓰기를 막으려면 배경을 거쳐야 한다.
     */
    lock?: string;
}) => {
    const {types, keyOf, normalize, get, set, failure, extra = {}, lock} = options;
    const typeOf = new Map<StorageItemKey, T>(types.map((type) => [keyOf(type), type]));

    const sync = storageSync([...typeOf.keys(), ...objectKeys(extra)], (key, value) => {
        const type = typeOf.get(key);
        if (type === undefined) {
            extra[key]?.(value);
            return;
        }
        const next = normalize(value);
        const lists = get();
        if (sizeOf(lists[type]) !== sizeOf(next) || canonical(lists[type]) !== canonical(next)) set({...lists, [type]: next});
    });

    // 쓰기를 한 줄로 세운다. update는 잠금 안에서 저장소를 다시 읽어 다른 창이 쓴 값을 덮지 않고 합친다.
    // 파이어폭스 콘텐츠 스크립트는 페이지의 navigator.locks에 콜백을 넘기면 (Xray 경계에서) 이유 없는 Error로 실패하므로 잠그지 않는다.
    // 대신 탭 안의 쓰기만 p-limit으로 줄을 세운다. 디시 탭끼리 동시에 쓰는 일은 드물고, 쓰기는 그대로 저장소의 현재 값에 합친다.
    const locks = lock && !(import.meta.env.BROWSER === "firefox" && location.protocol !== "moz-extension:") ? lock : undefined;
    const queue = pLimit(1);
    const enqueue = locks ? (write: () => Promise<void>): Promise<void> => navigator.locks.request(locks, write) : (write: () => Promise<void>): Promise<void> => queue(write);

    /**
     * 저장소의 현재 값에 change를 붙여 쓴다. 스토어에는 바로 반영해 두고, 잠금 안에서 다시 읽은 값에 붙인다.
     * change는 순수해야 한다 — 스토어 값과 저장소 값에 두 번 불리며, 결과는 저장소 쪽으로 맞춰진다.
     */
    const update = async (type: T, change: (current: V) => V): Promise<void> => {
        set({...get(), [type]: change(get()[type])});
        await sync.save(() => enqueue(async () => {
            const next = change(normalize(await storage.getItem(keyOf(type))));
            await storage.setItem(keyOf(type), next);
        }), failure);
    };

    return {...sync, update};
};
