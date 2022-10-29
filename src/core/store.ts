import browser from "webextension-polyfill";

export const set = (key: string, value: unknown): void => {
    const obj: { [index: string]: unknown } = {};
    obj[key] = value;
    (browser.storage.sync || browser.storage.local).set(obj);

    return;
};

export const get = (key: string | null): Promise<unknown> => {
    return new Promise<unknown>(resolve =>
        (browser.storage.sync || browser.storage.local)
            .get(key)
            .then((v: { [index: string]: unknown }) => {
                resolve(key === null ? v : v[key]);
            })
    );
};

export const all = (): Promise<unknown> => {
    return get(null);
};

export const clear = (): Promise<void> => {
    return new Promise<void>(resolve => {
        (browser.storage.sync || browser.storage.local)
            .clear()
            .then(resolve);
    });
};

export const module = {
    set(module: string, key: string, value: unknown): void {
        return set(`refresher.module:${module}-${key}`, value);
    },

    setGlobal(module: string, dump: unknown): void {
        return set(`refresher.module:${module}`, dump);
    },

    async get(module: string, key?: string): Promise<unknown> {
        let result = await get(
            key ? `refresher.module:${module}-${key}` : `refresher.module:${module}`
        );

        if (typeof result === "string" && (result as string).indexOf("{") == 0) {
            result = JSON.parse(result as string);
        }

        return result;
    }
};