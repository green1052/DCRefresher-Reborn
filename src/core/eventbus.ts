type RefresherEventListener<T extends unknown[]> = (...args: T) => void;

export class TypedEventBus {
    private target = new EventTarget();

    on<K extends keyof RefresherEventMap>(event: K, callback: RefresherEventListener<RefresherEventMap[K]>, options?: {
        once?: boolean
    }): () => void {
        const handler = (e: Event) => {
            const args = (e as CustomEvent).detail as RefresherEventMap[K];
            callback(...args);
        };
        this.target.addEventListener(event as string, handler, options?.once ? {once: true} : undefined);
        return () => this.target.removeEventListener(event as string, handler);
    }

    emit<K extends keyof RefresherEventMap>(event: K, ...args: RefresherEventMap[K]): void {
        this.target.dispatchEvent(new CustomEvent(event as string, {detail: args}));
    }

    emitNextTick<K extends keyof RefresherEventMap>(event: K, ...args: RefresherEventMap[K]): void {
        setTimeout(() => this.emit(event, ...args), 0);
    }
}

export const eventBus = new TypedEventBus();

export default eventBus;