const storageArea = browser.storage.local;

export const get = async <T>(key?: string | null): Promise<T> => {
    if (!key) {
        return storageArea.get(null) as Promise<T>;
    }

    const result = await storageArea.get(key);
    return result[key] as T;
};

export const set = async <T>(key: string, value: T): Promise<void> => {
    await storageArea.set({[key]: value});
};

export const setObject = async (items: Record<string, any>): Promise<void> => {
    await storageArea.set(items);
};

export const remove = async (keys: string | string[]): Promise<void> => {
    await storageArea.remove(keys);
};

export const clear = async (): Promise<void> => {
    await storageArea.clear();
};

export const moduleStorage = {
    async get<T>(module: string, key?: string): Promise<T> {
        const storageKey = key ? `refresher.module:${module}-${key}` : `refresher.module:${module}`;
        const value = await get<T>(storageKey);
        if (typeof value === "string") {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        return value;
    },
    set(module: string, key: string, value: unknown): void {
        set(`refresher.module:${module}-${key}`, value);
    },
    setGlobal(module: string, dump: unknown): void {
        set(`refresher.module:${module}`, dump);
    }
};

export default {
    get,
    set,
    setObject,
    remove,
    clear,
    module: moduleStorage
};
