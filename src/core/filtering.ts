import * as observe from "../utils/observe";
import * as strings from "../utils/string";

const lists: Record<string, RefresherFilteringLists> = {};

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

        lists[uuid] ??= {
            func: callback as <T>(elem: T) => void,
            scope,
            events: {},
            options
        };

        return uuid;
    },

    /**
     * 해당 UUID를 가진 필터를 제거합니다.
     */
    remove: (uuid: string, skip?: boolean): void => {
        if (skip && !lists[uuid]) return;

        if (!lists[uuid]) throw "Given UUID is not exists in the list.";

        filter.events(uuid, "remove");

        if (lists[uuid].options?.neverExpire && typeof lists[uuid].expire === "function") {
            lists[uuid].expire!();
        }

        delete lists[uuid];
    },

    /**
     * 해당 UUID의 이벤트에 콜백 함수를 등록합니다.
     */
    on: (uuid: string, event: string, cb: (...args: any[]) => void): void => {
        if (!uuid || !event) throw "Given UUID or event is not valid.";

        if (!lists[uuid]) throw "Given UUID is not exists in the list.";

        lists[uuid].events[event] ??= [];

        lists[uuid].events[event].push(cb);
    },

    /**
     * 해당 UUID에 이벤트를 발생시킵니다.
     */
    events: (uuid: string, event: string, ...args: any[]): void => {
        if (!uuid || !event) throw "Given UUID or event is not valid.";

        if (!lists[uuid]) throw "Given UUID is not exists in the list.";

        const eventObj = lists[uuid].events[event];

        if (!eventObj) return;

        for (const event of eventObj) event(...args);
    }
};
