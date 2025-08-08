import { Storage } from "@plasmohq/storage";

export const storage = new Storage({ area: "local" });

export const get = <T>(key?: string | null): Promise<T> => {
    if (!key) {
        return storage.getAll() as Promise<T>;
    }
    return storage.get(key) as Promise<T>;
};

export const set = <T>(key: string, value: T): Promise<void> => storage.set(key, value);

export const setObject = (items: Record<string, any>): Promise<void> => {
    return Promise.all(Object.entries(items).map(([key, value]) => storage.set(key, value))).then(() => {});
};

export const remove = (keys: string | string[]): Promise<void> => {
    if (Array.isArray(keys)) {
        return Promise.all(keys.map(key => storage.remove(key))).then(() => {});
    }
    return storage.remove(keys);
};

export const clear = (): Promise<void> => storage.clear();

export const moduleStorage = {
    async get<T>(module: string, key?: string): Promise<T> {
        const storageKey = key ? `refresher.module:${module}-${key}` : `refresher.module:${module}`;
        const value = await storage.get(storageKey);
        return typeof value === "string" && value.startsWith("{") ? JSON.parse(value) : value;
    },
    set(module: string, key: string, value: unknown): void {
        storage.set(`refresher.module:${module}-${key}`, value);
    },
    setGlobal(module: string, dump: unknown): void {
        storage.set(`refresher.module:${module}`, dump);
    }
};

export default {
    storage,
    get,
    set,
    setObject,
    remove,
    clear,
    module: moduleStorage
};
