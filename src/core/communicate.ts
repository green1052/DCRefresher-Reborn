import browser from "webextension-polyfill";

interface StorageStructure {
    uuid: string;
    run: (...args: any[]) => void;
}

const handlerStorage: Record<string, StorageStructure[]> = {};

browser.runtime.onMessage.addListener((message: any) => {
    if (typeof message !== "object" || !message.type) return;

    for (const handler of handlerStorage[message.type]) {
        handler.run(message.data);
    }
});

export const addHook = (type: string, callback: (...args: any[]) => void): string => {
    handlerStorage[type] ??= [];

    const uuid = crypto.randomUUID();

    handlerStorage[type].push({
        uuid,
        run: callback
    });

    return uuid;
};

export const clearHook = (type: string, id: string): boolean => {
    const hooks = handlerStorage[type];

    if (!hooks) return false;

    const oldLength = hooks.length;

    handlerStorage[type] = hooks.filter((hook) => hook.uuid !== id);

    return oldLength !== handlerStorage[type].length;
};

export default {
    addHook,
    clearHook
};
