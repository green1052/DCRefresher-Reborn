import { uuid } from "../utils/string";
import browser from "webextension-polyfill";

const handlerStorage: Record<string, StorageStructure[]> = {};

browser.runtime.onMessage.addListener((msg) => {
    if (!msg) return;

    if (!msg.type) throw "Received wrong runtimeMessage structure.";

    handlerStorage[msg.type]?.forEach((handler) => {
        handler.func(msg.data);
    });
});

interface StorageStructure {
    uuid: string;
    func: (...args: any[]) => void;
}

export const addHook = (
    type: string,
    callback: (...args: any[]) => void
): string => {
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

    const removed = oldLength !== handlerStorage[type].length;

    return removed;
};
