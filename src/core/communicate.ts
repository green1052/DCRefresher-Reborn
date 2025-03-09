import { uuid } from "../utils/string";
import browser from "webextension-polyfill";

interface StorageStructure {
    uuid: string;
    func: (...args: any[]) => void;
}

const handlerStorage: Record<string, StorageStructure[]> = {};

browser.runtime.onMessage.addListener((message) => {
    if (!message?.type) throw "Received wrong runtimeMessage structure.";

    for (const handler of handlerStorage[message.type]) {
        handler.func(message.data);
    }
});

export const addHook = (type: string, callback: (...args: any[]) => void): string => {
    handlerStorage[type] ??= [];

    const id = uuid();

    handlerStorage[type].push({
        uuid: id,
        func: callback
    });

    return id;
};

export const clearHook = (type: string, id: string): boolean => {
    const hooks = handlerStorage[type];

    if (!hooks) return false;

    const oldLength = hooks.length;

    handlerStorage[type] = hooks.filter((hook) => hook.uuid !== id);

    return oldLength !== handlerStorage[type].length;
};
