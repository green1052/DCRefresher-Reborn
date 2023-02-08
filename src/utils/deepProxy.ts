export default class DeepProxy {
    _preproxy: WeakMap<unknown, unknown>;
    _handler: ProxyHandler<Record<string, string>>;

    constructor(
        target: unknown,
        handler: ProxyHandler<Record<string, string>>
    ) {
        this._preproxy = new WeakMap();
        this._handler = handler;
        return this.proxify(target, []);
    }

    makeHandler(path: string[]): {
        set: (
            target: Record<string, string>,
            key: string,
            value: unknown,
            receiver: unknown
        ) => boolean;
        deleteProperty: (
            target: Record<string, string>,
            key: string
        ) => boolean;
    } {
        const dp = this;
        return {
            set(target, key, value, receiver) {
                if (typeof value === "object") {
                    value = dp.proxify(value, [...path, key]);
                }
                target[key] = value;

                if (dp._handler.set) {
                    dp._handler.set(target, [...path, key], value, receiver);
                }
                return true;
            },

            deleteProperty(target, key) {
                if (Reflect.has(target, key)) {
                    dp.unproxy(target, key);
                    const deleted = Reflect.deleteProperty(target, key);
                    if (deleted && dp._handler.deleteProperty) {
                        dp._handler.deleteProperty(target, [...path, key]);
                    }
                    return deleted;
                }
                return false;
            }
        };
    }

    unproxy(
        obj: Record<string, Record<string, unknown>> | unknown,
        key: string
    ): void {
        if (this._preproxy.has(obj[key])) {
            // console.log('unproxy',key);
            obj[key] = this._preproxy.get(obj[key]);
            this._preproxy.delete(obj[key]);
        }

        for (const k of Object.keys(obj[key])) {
            if (typeof obj[key][k] === "object") {
                this.unproxy(obj[key], k);
            }
        }
    }

    proxify(
        obj: Record<string, Record<string, unknown>> | unknown,
        path: string[]
    ): unknown {
        for (const key of Object.keys(obj)) {
            if (typeof obj[key] === "object") {
                obj[key] = this.proxify(obj[key], [...path, key]);
            }
        }
        const p = new Proxy(obj, this.makeHandler(path));
        this._preproxy.set(p, obj);
        return p;
    }
}
