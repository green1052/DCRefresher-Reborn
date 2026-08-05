type RefresherEventListener<T extends unknown[]> = (...args: T) => void;

export class TypedEventBus {
    private listeners = new Map<string, Set<Function>>();

    on<K extends keyof RefresherEventMap>(event: K, callback: RefresherEventListener<RefresherEventMap[K]>, options?: {
        once?: boolean
    }): () => void {
        const key = event as string;
        let set = this.listeners.get(key);
        if (!set) {
            set = new Set();
            this.listeners.set(key, set);
        }

        const wrapped = options?.once
            ? (...args: unknown[]) => {
                  set!.delete(wrapped);
                  callback(...(args as RefresherEventMap[K]));
              }
            : (callback as unknown as Function);

        set.add(wrapped);

        return () => {
            set!.delete(wrapped);
            if (set!.size === 0) this.listeners.delete(key);
        };
    }

    emit<K extends keyof RefresherEventMap>(event: K, ...args: RefresherEventMap[K]): void {
        const set = this.listeners.get(event as string);
        if (!set) return;
        for (const fn of set) {
            (fn as (...a: RefresherEventMap[K]) => void)(...args);
        }
    }

    emitNextTick<K extends keyof RefresherEventMap>(event: K, ...args: RefresherEventMap[K]): void {
        setTimeout(() => this.emit(event, ...args), 0);
    }
}

export const eventBus = new TypedEventBus();

export default eventBus;