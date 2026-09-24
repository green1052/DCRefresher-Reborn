import Emittery from "emittery";

import type {ModuleEventMap} from "./types";

export class TypedEventBus<M extends {[K in keyof M]: unknown[]}> {
    private readonly emitter = new Emittery<Record<string, unknown[]>>();

    public on<K extends keyof M & string>(event: K, callback: (...args: M[K]) => void): () => void {
        // Emittery v2: 리스너가 {name, data} 객체를 받음
        return this.emitter.on(event, ({data}) => callback(...(data as M[K])));
    }

    public emit<K extends keyof M & string>(event: K, ...args: M[K]): void {
        this.emitter.emit(event, args).catch(() => {});
    }
}

export const eventBus = new TypedEventBus<ModuleEventMap>();
