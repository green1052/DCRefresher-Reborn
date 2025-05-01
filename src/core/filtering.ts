import * as observe from "../utils/observe";

const lists: Record<string, RefresherFilteringLists> = {};

export const filter = {
    __run: async (filteringLists: RefresherFilteringLists, elements: NodeListOf<HTMLElement>): Promise<void> => {
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
        if (skip) return;

        if (!uuid) throw "Given UUID is not valid.";

        const event = lists[uuid];

        if (!event) throw "Given UUID is not exists in the list.";

        filter.emit(uuid, "remove");

        if (event.options?.neverExpire && typeof event.expire === "function") {
            event.expire();
        }

        delete lists[uuid];
    },

    on: (uuid: string, event: string, cb: (...args: any[]) => void): void => {
        if (!uuid || !event) throw "Given UUID or event is not valid.";

        if (!event) throw "Given UUID is not exists in the list.";

        lists[uuid].events[event] ??= [];
        lists[uuid].events[event].push(cb);
    },

    emit: (uuid: string, event: string, ...args: any[]): void => {
        if (!uuid || !event) throw "Given UUID or event is not valid.";
        if (!event) throw "Given UUID is not exists in the list.";

        const eventObj = lists[uuid].events[event];

        if (!eventObj) return;

        for (const event of eventObj) event(...args);
    }
};

export default filter;
