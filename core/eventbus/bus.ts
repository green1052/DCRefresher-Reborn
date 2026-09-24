import type {ModuleEventMap} from "./types";

type EventListener<T extends unknown[]> = (...args: T) => void;

export class TypedEventBus<M extends {[K in keyof M]: unknown[]}> {
    private listeners = new Map<keyof M & string, Set<Function>>();

    on<K extends keyof M & string>(event: K, callback: EventListener<M[K]>, options?: {once?: boolean}): () => void {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }

        const wrapped = options?.once
            ? (...args: unknown[]) => {
                set.delete(wrapped);
                callback(...(args as M[K]));
            }
            : (callback as unknown as Function);

        set.add(wrapped);

        return () => {
            set.delete(wrapped);
            if (set.size === 0) this.listeners.delete(event);
        };
    }

    emit<K extends keyof M & string>(event: K, ...args: M[K]): void {
        const set = this.listeners.get(event);
        if (!set) return;
        for (const fn of [...set]) {
            (fn as EventListener<M[K]>)(...args);
        }
    }

    emitNextTick<K extends keyof M & string>(event: K, ...args: M[K]): void {
        setTimeout(() => this.emit(event, ...args), 0);
    }
}

export const eventBus = new TypedEventBus<ModuleEventMap>();
