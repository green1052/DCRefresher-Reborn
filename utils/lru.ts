interface Entry<V> {
    value: V;
    /** 만료 시각(ms). 0이면 만료되지 않는다. */
    expires: number;
    timer?: ReturnType<typeof setTimeout>;
}

/**
 * 작은 LRU 캐시. 콘텐츠 스크립트에 lru-cache(18 kB)를 싣지 않으려고 쓰는 기능만 둔다.
 * Map은 넣은 순서를 지키므로, 읽을 때 다시 넣어 맨 뒤로 보내고 넘치면 맨 앞(가장 오래 안 쓴 것)을 버린다.
 * - ttl: 저장한 뒤 이 시간(ms)이 지나면 없는 것으로 본다. 다시 저장하면 수명이 처음부터 다시 간다.
 * - autopurge: 만료될 때 지워 값(본문 HTML 등)이 밀려날 때까지 메모리에 남지 않게 한다.
 */
export class LruCache<K, V> {
    readonly #entries = new Map<K, Entry<V>>();
    readonly #max: number;
    readonly #ttl: number;
    readonly #autopurge: boolean;

    constructor({max, ttl = 0, autopurge = false}: { max: number; ttl?: number; autopurge?: boolean }) {
        this.#max = max;
        this.#ttl = ttl;
        this.#autopurge = autopurge;
    }

    get size(): number {
        return this.#entries.size;
    }

    get(key: K): V | undefined {
        const entry = this.#entries.get(key);
        if (!entry) return undefined;
        if (entry.expires && entry.expires <= Date.now()) {
            this.delete(key);
            return undefined;
        }
        this.#entries.delete(key);
        this.#entries.set(key, entry);
        return entry.value;
    }

    has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    set(key: K, value: V): this {
        this.delete(key);
        const entry: Entry<V> = {value, expires: this.#ttl ? Date.now() + this.#ttl : 0};
        if (this.#ttl && this.#autopurge) {
            entry.timer = setTimeout(() => {
                if (this.#entries.get(key) === entry) this.#entries.delete(key);
            }, this.#ttl);
        }
        this.#entries.set(key, entry);

        if (this.#entries.size > this.#max) this.delete(this.#entries.keys().next().value as K);
        return this;
    }

    delete(key: K): boolean {
        const entry = this.#entries.get(key);
        if (entry?.timer !== undefined) clearTimeout(entry.timer);
        return this.#entries.delete(key);
    }

    clear(): void {
        for (const entry of this.#entries.values()) {
            if (entry.timer !== undefined) clearTimeout(entry.timer);
        }
        this.#entries.clear();
    }

    /** 있으면 그 값, 없으면 compute로 만들어 저장한다. */
    memo(key: K, compute: (key: K) => V): V {
        const cached = this.get(key);
        if (cached !== undefined) return cached;
        const value = compute(key);
        this.set(key, value);
        return value;
    }
}
