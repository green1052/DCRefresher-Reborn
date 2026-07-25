// LRU(Least Recently Used) 캐시 - Map의 삽입 순서 보존 특성 활용
// 캐시 크기 제한으로 메모리 누수 방지

export class LRUCache<K, V> {
    private cache: Map<K, V> = new Map();
    private readonly maxSize: number;

    constructor(maxSize: number = 500) {
        this.maxSize = maxSize;
    }

    get size(): number {
        return this.cache.size;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value === undefined) return undefined;

        // LRU: 접근 시 최근 사용 위치로 이동
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key: K, value: V): void {
        // 이미 존재하면 기존 항목 삭제하여 LRU 순서 갱신
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // 가장 오래된 항목 제거 (Map의 첫 번째 항목)
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}

export default LRUCache;