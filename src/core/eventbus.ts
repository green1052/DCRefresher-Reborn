import * as strings from "../utils/string";

const lists: Record<string, RefresherEventBusObject[]> = {};

export const eventBus: RefresherEventBus = {
    /**
     * lists에 등록된 이벤트 콜백을 호출합니다.
     *
     * @param event 호출 할 이벤트 이름.
     * @param params 호출 할 이벤트에 넘길 인자.
     */
    emit: (event: string, ...params: any[]) => {
        if (!lists[event]) return;

        for (const callback of lists[event]) {
            callback.func(...params);

            if (callback.once) eventBus.remove(event, callback.uuid);
        }
    },

    emitNextTick: (event: string, ...params: any[]) => {
        return requestAnimationFrame(() => eventBus.emit(event, ...params));
    },

    /**
     * lists 에 이벤트 콜백을 등록합니다.
     *
     * @param event 등록 될 이벤트 이름.
     * @param callback 나중에 호출 될 이벤트 콜백 함수.
     * @param options 이벤트에 등록할 옵션.
     */
    on: (event: string, callback: () => void, options?: RefresherEventBusOptions): string => {
        const uuid = strings.uuid();

        lists[event] ??= [];

        const obj: RefresherEventBusObject = {
            func: callback,
            uuid
        };

        if (options?.once) {
            obj.once = true;
        }

        lists[event].push(obj);

        return uuid;
    },

    /**
     * lists 에 있는 이벤트 콜백을 제거합니다.
     */
    remove: (event: string, uuid: string, skip?: boolean) => {
        if (skip && !lists[event]) return;

        if (!lists[event]) throw "Given Event is not exists in the list.";

        const index = lists[event].findIndex((callback) => callback.uuid == uuid);

        if (index == -1) throw "Given UUID is not exists in the list.";

        lists[event].splice(index, 1);
    }
};
