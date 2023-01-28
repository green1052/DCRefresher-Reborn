import * as strings from "../utils/string";
import * as observe from "../utils/observe";

const lists: { [index: string]: RefresherFilteringLists } = {};

export const filter = {
    __run: async (
        filteringLists: RefresherFilteringLists,
        elements: NodeListOf<HTMLElement>
    ): Promise<void> => {
        for (const element of elements) {
            filteringLists.func(element);
        }
    },
    /**
     * 필터로 등록된 함수들을 전부 실행합니다.
     */
    run: async (): Promise<void> => {
        for (const [, filterObj] of Object.entries(lists)) {
            if (filterObj.options?.neverExpire !== undefined) {
                filterObj.expire?.();

                const observer = observe.listen(
                    filterObj.scope,
                    document.documentElement,
                    (e) => {
                        filter.__run(filterObj, e);
                    }
                );

                filterObj.expire = () => observer?.disconnect();

                continue;
            }

            observe
                .find(filterObj.scope, document.documentElement)
                .then((e) => filter.__run(filterObj, e))
                .catch((e) => {
                    if (filterObj.options === undefined || filterObj.options.skipIfNotExists === undefined)
                        throw e;
                });
        }
    },

    /**
     * 파라매터로 주어진 UUID를 가진 필터를 실행합니다.
     *
     * @param id UUID를 지정합니다.
     */
    runSpecific: (id: string): Promise<void> => {
        const item = lists[id];

        return observe
            .find(item.scope, document.documentElement)
            .then((e) => filter.__run(item, e));
    },

    /**
     * 필터로 사용할 함수를 등록합니다.
     */
    add: <T = HTMLElement>(
        scope: string,
        callback: (element: T) => void,
        options?: RefresherFilteringOptions
    ): string => {
        const uuid = strings.uuid();

        if (typeof lists[uuid] === "undefined") {
            lists[uuid] = {
                func: callback,
                scope,
                events: {},
                options
            } as RefresherFilteringLists;
        }

        return uuid;
    },

    /**
     * UUID를 직접 선언하여 함수를 필터로 등록합니다.
     */
    addGlobal: (id: string, scope: string, callback: () => void): void => {
        lists[id] = {
            func: callback,
            scope,
            events: {}
        };
    },

    /**
     * 해당 UUID를 가진 필터를 제거합니다.
     */
    remove: (uuid: string, skip?: boolean): void => {
        if (skip === true && typeof lists[uuid] === "undefined") return;

        if (typeof lists[uuid] === "undefined") {
            throw "Given UUID is not exists in the list.";
        }

        filter.events(uuid, "remove");

        if (lists[uuid].options?.neverExpire !== undefined && typeof lists[uuid].expire === "function") {
            lists[uuid].expire!();
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

        for (const event of eventObj) {
            event(...args);
        }
    }
};