export interface CacheEntry {
    date: number;
    post?: IPostInfo;
    comment?: DcinsideComments;
    deleted?: boolean;
}

export class PostCache {
    private caches: Map<string, CacheEntry> = new Map();
    private maxCacheSize: number;

    constructor(maxCacheSize: number = 50) {
        this.maxCacheSize = maxCacheSize;
    }

    static key(gallery: string, id: string): string {
        return `${gallery}${id}`;
    }

    get(id: string, ignoreTimeout = false): CacheEntry | undefined {
        const cache = this.caches.get(id);
        if (!cache) return undefined;

        if (!ignoreTimeout && Date.now() - cache.date > 1000 * 60) {
            return undefined;
        }

        // LRU: 접근 시 최근 사용 위치로 이동
        this.caches.delete(id);
        this.caches.set(id, cache);

        return cache;
    }

    set(id: string, data: CacheEntry): void {
        // 이미 존재하면 기존 항목을 삭제하여 LRU 순서 갱신
        if (this.caches.has(id)) {
            this.caches.delete(id);
        } else if (this.caches.size >= this.maxCacheSize) {
            // 가장 오래된 항목 제거 (Map의 첫 번째 항목)
            const oldestKey = this.caches.keys().next().value;
            if (oldestKey !== undefined) {
                this.caches.delete(oldestKey);
            }
        }

        const existing = this.caches.get(id);
        this.caches.set(id, {
            ...(existing ?? {}),
            ...data
        });
    }

    delete(id: string): boolean {
        return this.caches.delete(id);
    }
}