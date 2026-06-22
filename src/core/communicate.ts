interface StorageStructure {
    uuid: string;
    run: (payload: unknown) => void | Promise<void>;
}

const handlerStorage: Record<string, StorageStructure[]> = {};

interface RuntimeHookMessage {
    type: string;
    data?: unknown;
}

const isRuntimeHookMessage = (value: unknown): value is RuntimeHookMessage => {
    return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
};

browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isRuntimeHookMessage(message)) return;

    const handlers = handlerStorage[message.type];
    if (!handlers) return;

    for (const handler of handlers) {
        try {
            void Promise.resolve(handler.run(message.data)).catch((error) => {
                console.error(`Runtime hook failed: ${message.type}`, error);
            });
        } catch (error) {
            console.error(`Runtime hook failed: ${message.type}`, error);
        }
    }
});

export const addHook = (type: string, callback: (payload: unknown) => void | Promise<void>): string => {
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
