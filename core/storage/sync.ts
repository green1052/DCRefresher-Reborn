import pLimit from "p-limit";
import {storage, type StorageItemKey} from "wxt/utils/storage";

import {onBfcacheRestore} from "@/utils/dom";
import {saveOrReload} from "@/utils/error";
import {once} from "@/utils/once";
import {isRecord} from "@/utils/record";
import {objectKeys} from "@/utils/typed";

/** storage.watch를 signal이 끝날 때 푼다 - 파이어폭스 재주입이 남긴 죽은 감시를 막는다. */
export const watchStorage = <T>(key: StorageItemKey, callback: (next: T | null, previous: T | null) => void, signal?: AbortSignal): (() => void) => {
    // 끝난 signal에는 abort가 다시 오지 않아 걸면 풀 길이 없다.
    if (signal?.aborted) return () => {};
    const unwatch = storage.watch<T>(key, callback);
    const dispose = (): void => {
        // 확장이 무효화된 뒤에는 storage.onChanged.removeListener가 던지고, 리스너도 이미 죽었다.
        if (browser.runtime?.id) unwatch();
    };
    signal?.addEventListener("abort", dispose, {once: true});
    return dispose;
};

/** getItems는 순서를 약속하지 않아 키로 짝짓는다. */
export const readItems = async (keys: readonly StorageItemKey[]): Promise<Map<StorageItemKey, unknown>> =>
    new Map((await storage.getItems([...keys])).map(({key, value}) => [key, value]));

/** 여러 키를 한 번에 읽고 감시해 apply에 넘긴다. 쓰기가 남아 있는 동안은 apply하지 않는다. */
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
        // 감시를 먼저 걸고, 읽는 사이 바뀐 키는 읽은 값을 넣지 않는다 - 놓친 변경을 옛 값으로 덮지 않게.
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
        // write을 Promise에 실어 보낸다 - 동기적으로 던지면 finally가 돌지 않아 pending이 영원히 남는다.
        await saveOrReload(Promise.resolve().then(write).finally(() => pending--), load, failure);
        // 저장은 됐다. 다시 읽지 못해도 스토어는 이미 저장한 값을 들고 있다.
        if (pending === 0) await load().catch(console.error);
    };

    return {load, start, save};
};

/** 객체 키를 정렬해 직렬화한다. 크롬 저장소는 키를 정렬해 돌려주므로, 그대로 비교하면 이 탭이 쓴 값이 돌아올 때 다른 값이 된다. */
export const canonical = (value: unknown): string =>
    JSON.stringify(value, (_key, item: unknown) => (isRecord(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item));

/** 항목 수. 수가 다르면 직렬화해 볼 것도 없이 다른 값이다 (목록이 수천 개면 canonical이 탭마다 몇 ms 걸린다). */
const sizeOf = (value: unknown): number | undefined => (Array.isArray(value) ? value.length : isRecord(value) ? Object.keys(value).length : undefined);

/** 쓰기를 Web Locks로 줄 세운다. 파이어폭스 콘텐츠 스크립트는 콜백이 Xray 경계에서 실패하므로 p-limit으로만 줄을 세운다. */
export const writeQueue = (lock?: string): ((write: () => Promise<void>) => Promise<void>) => {
    const usable = lock && !(import.meta.env.BROWSER === "firefox" && location.protocol !== "moz-extension:") ? lock : undefined;
    const queue = pLimit(1);
    return usable ? (write) => navigator.locks.request(usable, write) : (write) => queue(write);
};

/** 유형마다 키 하나에 저장하는 목록(차단, 메모)을 스토어와 양방향으로 맞춘다. 값이 같으면 스토어를 건드리지 않는다. */
export const typedListSync = <T extends string, V>(options: {
    types: readonly T[];
    keyOf: (type: T) => StorageItemKey;
    normalize: (value: unknown) => V;
    get: () => Record<T, V>;
    set: (lists: Record<T, V>) => void;
    failure: string;
    extra?: Partial<Record<StorageItemKey, (value: unknown) => void>>;
/** Web Locks 이름. 목록 쓰기는 읽고-고쳐-쓰기라 여러 창이 동시에 쓰면 앞의 쓰기를 덮는다. */
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

    const enqueue = writeQueue(lock);

    /** 저장소의 현재 값에 change를 붙여 쓴다. change는 순수해야 한다 - 두 번 불리고 결과는 저장소 쪽으로 맞춰진다. */
    const update = async (type: T, change: (current: V) => V): Promise<void> => {
        set({...get(), [type]: change(get()[type])});
        await sync.save(() => enqueue(async () => {
            const next = change(normalize(await storage.getItem(keyOf(type))));
            await storage.setItem(keyOf(type), next);
        }), failure);
    };

    return {...sync, update};
};
