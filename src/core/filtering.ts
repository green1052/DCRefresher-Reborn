import * as observe from "../utils/observe";

const lists: Record<string, RefresherFilteringLists> = {};

export const filter = {
    ids: (): string[] => Object.keys(lists),

    __run: async (filteringLists: RefresherFilteringLists, elements: Iterable<HTMLElement>): Promise<void> => {
        for (const element of elements) {
            filteringLists.func(element);
        }
    },

    run: async (): Promise<void> => {
        for (const filterObj of Object.values(lists)) {
            if (filterObj.options?.neverExpire) {
                filterObj.expire?.();

                const observer = observe.listen(filterObj.scope, document.documentElement, (e) => {
                    filter.__run(filterObj, e);
                });

                filterObj.expire = () => observer.disconnect();

                continue;
            }

            observe
                .find(filterObj.scope, document.documentElement)
                .then((e) => filter.__run(filterObj, e))
                .catch((e) => {
                    if (!filterObj.options?.skipIfNotExists) throw e;
                });
        }
    },

    runSpecific: (id: string): Promise<void> => {
        const item = lists[id];

        if (!item) return Promise.resolve();

        if (item.options?.neverExpire) {
            item.expire?.();

            const observer = observe.listen(item.scope, document.documentElement, (elements) => {
                void filter.__run(item, elements);
            });

            item.expire = () => observer.disconnect();
            return Promise.resolve();
        }

        return observe.find(item.scope, document.documentElement).then((e) => filter.__run(item, e));
    },

    add: <T = HTMLElement>(
        scope: string,
        callback: (element: T) => void,
        options?: RefresherFilteringOptions
    ): string => {
        const uuid = crypto.randomUUID();

        lists[uuid] = {
            func: callback,
            scope,
            events: {},
            options
        };

        return uuid;
    },

    remove: (uuid: string, skip?: boolean): void => {
        if (!uuid) {
            if (skip) return;
            throw new Error("Given UUID is not valid.");
        }

        const event = lists[uuid];

        if (!event) {
            if (skip) return;
            throw new Error("Given UUID is not exists in the list.");
        }

        filter.emit(uuid, "remove");

        if (event.options?.neverExpire && typeof event.expire === "function") {
            event.expire();
        }

        delete lists[uuid];
    },

    on: (uuid: string, event: string, cb: (...args: unknown[]) => void): void => {
        if (!uuid || !event) throw new Error("Given UUID or event is not valid.");

        if (!lists[uuid]) throw new Error("Given UUID does not exist in the list.");

        lists[uuid].events[event] ??= [];
        lists[uuid].events[event].push(cb);
    },

    emit: (uuid: string, event: string, ...args: unknown[]): void => {
        if (!uuid || !event) throw new Error("Given UUID or event is not valid.");
        if (!lists[uuid]) throw new Error("Given UUID does not exist in the list.");

        const eventObj = lists[uuid].events[event];

        if (!eventObj) return;

        for (const event of eventObj) event(...args);
    }
};

export default filter;
