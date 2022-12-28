import * as strings from "../utils/string";

const lists: { [index: string]: RefresherEventBusObject[] } = {};

export const eventBus: RefresherEventBus = {
    /**
     * lists에 등록된 이벤트 콜백을 호출합니다.
     *
     * @param event 호출 할 이벤트 이름.
     * @param params 호출 할 이벤트에 넘길 인자.
     */
    emit: (event: string, ...params: any[]) => {
        if (!lists[event]) {
            return;
        }

        const remove_queue = [];

        let iter = lists[event].length;
        while (iter--) {
            const callback = lists[event][iter];
            callback.func(...params);

            if (callback.once) {
                remove_queue.push(iter);
            }
        }

        remove_queue.map((v, i) => {
            lists[event].splice(v - i, 1);
        });

        // TODO : 왜 이상하게 짬?
    },

    emitNextTick: (event: string, ...params: any[]) => {
        return requestAnimationFrame(() => eventBus.emit(event, ...params));
    },

    /**
     * lists에 등록된 이벤트 콜백을 호출하면서 생긴 값을 반환합니다.
     *
     * @param event 호출 할 이벤트 이름.
     * @param params 호출 할 이벤트에 넘길 인자.
     * @returns {Promise} 모든 이벤트가 종료되기 전까지 대신 받을 Promise.
     */
    emitForResult: (event: string, ...params: any[]) => {
        if (!lists[event]) {
            throw "Given event is not defined.";
        }

        return new Promise((resolve, reject) => {
            const results = [];

            const remove_queue: number[] = [];

            let iter = lists[event].length;
            while (iter--) {
                const callback = lists[event][iter];

                try {
                    results.push(callback.func(...params));
                } catch (e) {
                    reject(e);
                }
            }

            remove_queue.map((v, i) => {
                lists[event].splice(v - i, 1);
            });

            Promise.all(results).then((value) => {
                resolve(...value);
            });
        });
    },

    /**
     * lists 에 이벤트 콜백을 등록합니다.
     *
     * @param event 등록 될 이벤트 이름.
     * @param cb 나중에 호출 될 이벤트 콜백 함수.
     * @param options 이벤트에 등록할 옵션.
     */
    on: (
        event: string,
        cb: () => void,
        options?: RefresherEventBusOptions
    ): string => {
        const uuid = strings.uuid();

        if (typeof lists[event] === "undefined") {
            lists[event] = [];
        }

        const obj: RefresherEventBusObject = {
            func: cb,
            uuid
        };

        if (options && options.once) {
            obj.once = true;
        }

        lists[event].push(obj);

        return uuid;
    },

    /**
     * lists 에 있는 이벤트 콜백을 제거합니다.
     */
    remove: (event: string, uuid: string, skip?: boolean) => {
        if (skip && typeof lists[event] === "undefined") {
            return;
        }

        if (typeof lists[event] === "undefined") {
            throw "Given Event is not exists in the list.";
        }

        const callbacks = lists[event];

        let iter = callbacks.length;
        while (iter--) {
            if (callbacks[iter].uuid && callbacks[iter].uuid == uuid) {
                callbacks.splice(iter, 1);
                break;
            }
        }

        delete lists[uuid];
    }
};