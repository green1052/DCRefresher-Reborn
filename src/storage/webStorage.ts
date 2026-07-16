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

export const remove = async (key: string): Promise<void> => {
    await storageArea.remove(key);
};

export const moduleStorage = {
    async get<T>(module: string, key?: string): Promise<T> {
        const storageKey = key ? `refresher.module:${module}-${key}` : `refresher.module:${module}`;
        const value = await get<T>(storageKey);
        if (typeof value === "string") {
            try {
                return JSON.parse(value) as T;
            } catch {
                return value as T;
            }
        }
        return value;
    },
    async set(module: string, key: string, value: unknown): Promise<void> {
        await set(`refresher.module:${module}-${key}`, value);
    },
    async setGlobal(module: string, dump: unknown): Promise<void> {
        await set(`refresher.module:${module}`, dump);
    }
};

export default {
    get,
    set,
    remove,
    module: moduleStorage
};
