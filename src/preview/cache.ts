export interface CacheEntry {
    date: number;
    post?: IPostInfo;
    comment?: DcinsideComments;
    deleted?: boolean;
}

export class PostCache {
    caches: Record<string, CacheEntry> = {};

    constructor(public maxCacheSize: number = 50) {
    }

    get(id: string, ignoreTimeout = false): CacheEntry | undefined {
        const cache = this.caches[id];
        if (!cache) return undefined;

        if (!ignoreTimeout && Date.now() - cache.date > 1000 * 60) {
            return undefined;
        }

        return cache;
    }

    set(id: string, data: CacheEntry): void {
        if (Object.keys(this.caches).length > this.maxCacheSize) {
            const lastCache = Object.keys(this.caches)[0];
            this.delete(lastCache);
        }

        this.caches[id] = {
            ...(this.caches[id] ?? {}),
            ...data
        };
    }

    delete(id: string): boolean {
        if (!this.caches[id]) return false;
        delete this.caches[id];
        return true;
    }
}