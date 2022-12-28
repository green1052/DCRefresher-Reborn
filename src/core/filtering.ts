import * as strings from "../utils/string";
import * as observe from "../utils/observe";

const lists: { [index: string]: RefresherFilteringLists } = {};

export const filter: RefresherFilter = {
    __run: async (
        a: RefresherFilteringLists,
        e: NodeListOf<Element>
    ): Promise<void> => {
        let iter = e.length;

        if (!iter) return;
        while (iter--) {
            a.func(e[iter]);
        }
    },
    /**
     * lists에 등록된 필터 함수를 호출합니다.
     *
     */
    run: async (): Promise<void> => {
        const listsKeys = Object.keys(lists);

        let len = listsKeys.length;
        while (len--) {
            const filterObj = lists[listsKeys[len]];

            if (filterObj.options && filterObj.options.neverExpire) {
                if (lists[listsKeys[len]].expire) {
                    lists[listsKeys[len]].expire();
                }

                const observer = observe.listen(
                    filterObj.scope,
                    document.documentElement,
                    (e: NodeListOf<Element>) => {
                        filter.__run(filterObj, e);
                    }
                );

                lists[listsKeys[len]].expire = () => {
                    if (observer) {
                        observer.disconnect();
                    }
                };
            } else {
                observe
                    .find(filterObj.scope, document.documentElement)
                    .then((e) => filter.__run(filterObj, e))
                    .catch((e) => {
                        if (!filterObj.options || !filterObj.options.skipIfNotExists) {
                            throw e;
                        }
                    });
            }
        }
    },

    runSpecific: (id: string): Promise<void> => {
        const item = lists[id];

        return observe
            .find(item.scope, document.documentElement)
            .then(async (e) => filter.__run(item, e));
    },

    /**
     * 필터 lists 에 필터 함수를 등록합니다.
     */
    add: (
        scope: string,
        cb: (elem: Element) => void,
        options?: RefresherFilteringOptions
    ): string => {
        const uuid = strings.uuid();

        if (typeof lists[uuid] === "undefined") {
            const obj = {
                func: cb,
                scope,
                events: {},
                options
            };

            lists[uuid] = obj;
        }

        return uuid;
    },

    addGlobal: (id: string, scope: string, cb: () => void): void => {
        lists[id] = {
            func: cb,
            scope,
            events: {}
        };

        return;
    },

    /**
     * 필터 lists 에 있는 필터 함수를 제거합니다.
     */
    remove: (uuid: string, skip?: boolean): void => {
        if (skip && typeof lists[uuid] === "undefined") {
            return;
        }

        if (typeof lists[uuid] === "undefined") {
            throw "Given UUID is not exists in the list.";
        }

        filter.events(uuid, "remove");

        if (lists[uuid].options && lists[uuid].options?.neverExpire) {
            if (typeof lists[uuid].expire === "function") {
                lists[uuid].expire();
            }
        }

        delete lists[uuid];
    },

    /**
     * 해당 UUID의 이벤트에 콜백 함수를 등록합니다.
     */
    on: (uuid: string, event: string, cb: (...args: any[]) => void): void => {
        if (uuid == "" || event == "") {
            throw "Given UUID or event is not valid.";
        }

        if (typeof lists[uuid] === "undefined") {
            throw "Given UUID is not exists in the list.";
        }

        if (typeof lists[uuid].events[event] === "undefined") {
            lists[uuid].events[event] = [];
        }

        lists[uuid].events[event].push(cb);
    },

    /**
     * 해당 UUID에 이벤트를 발생시킵니다.
     */
    events: (uuid: string, event: string, ...args: any[]): void => {
        if (uuid == "" || event == "") {
            throw "Given UUID or event is not valid.";
        }

        if (typeof lists[uuid] === "undefined") {
            throw "Given UUID is not exists in the list.";
        }

        if (typeof lists[uuid].events[event] === "undefined") {
            return;
        }

        const eventObj = lists[uuid].events[event];
        let eventIter = eventObj.length;

        while (eventIter--) {
            eventObj[eventIter](...args);
        }
    }
};