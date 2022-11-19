import browser from "webextension-polyfill";

interface ResponseData {
    [key: string]: unknown;
}

export const storage = browser.storage.sync || browser.storage.local;

export function get<T>(key?: string | null): Promise<T> {
    return new Promise(async (resolve) => {
        const value: ResponseData = await storage.get(key);
        resolve(key === null || key === undefined ? value as T : value[key] as T);
    });
}

export function set<T>(key: string, value: T): void {
    storage.set({[key]: value});
}

export function remove(keys: string | string[]): void {
    storage.remove(keys);
}

export const module = {
    get<T>(module: string, key?: string): Promise<T> {
        return new Promise(async (resolve) => {
            const value = await get(key ? `refresher.module:${module}-${key}` : `refresher.module:${module}`);

            if (typeof value === "string" && value.indexOf("{") == 0) {
                resolve(JSON.parse(value as string) as T);
            }

            resolve(value as T);
        });
    },
    set(module: string, key: string, value: unknown): void {
        set(`refresher.module:${module}-${key}`, value);
    },
    setGlobal(module: string, dump: unknown): void {
        set(`refresher.module:${module}`, dump);
    }
};

export default {
    storage,
    get,
    set,
    remove,
    module
};