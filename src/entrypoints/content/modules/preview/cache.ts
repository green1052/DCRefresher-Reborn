export interface CacheEntry {
    date: number;
    post?: IPostInfo;
    comment?: DcinsideComments;
    deleted?: boolean;
}

export class PostCache {
    caches: Record<string, CacheEntry> = {};
    private order: string[] = [];

    constructor(public maxCacheSize: number = 50) {
    }

    static key(gallery: string, id: string): string {
        return `${gallery}${id}`;
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
        if (!this.caches[id] && this.order.length > this.maxCacheSize) {
            const oldest = this.order.shift()!;
            delete this.caches[oldest];
        }

        if (!this.caches[id]) {
            this.order.push(id);
        }

        this.caches[id] = {
            ...(this.caches[id] ?? {}),
            ...data
        };
    }

    delete(id: string): boolean {
        if (!this.caches[id]) return false;
        delete this.caches[id];
        this.order = this.order.filter((key) => key !== id);
        return true;
    }
}