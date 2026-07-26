import {LRUCache} from "@/utils/lruCache";

export interface CacheEntry {
    date: number;
    post?: IPostInfo;
    comment?: DcinsideComments;
    deleted?: boolean;
}

const CACHE_TIMEOUT = 1000 * 60;

export class PostCache {
    readonly #caches: LRUCache<string, CacheEntry>;

    constructor(maxCacheSize = 50) {
        this.#caches = new LRUCache(maxCacheSize);
    }

    static key(gallery: string, id: string): string {
        return `${gallery}:${id}`;
    }

    get(id: string, ignoreTimeout = false): CacheEntry | undefined {
        const cache = this.#caches.get(id);
        if (!cache) return undefined;

        if (!ignoreTimeout && Date.now() - cache.date > CACHE_TIMEOUT) return undefined;

        return cache;
    }

    // 본문과 댓글이 따로 들어오므로 기존 항목에 합친다.
    set(id: string, data: CacheEntry): void {
        this.#caches.set(id, {...this.#caches.get(id), ...data});
    }
}
