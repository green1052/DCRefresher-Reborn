import {createStore} from "zustand/vanilla";
import type {StoreApi} from "zustand/vanilla";

import {useSyncExternalStore} from "./useSyncExternalStore";

/** zustand의 react 바인딩(useSyncExternalStore 사용)을 preact용으로 대신한 useStore. vanilla 스토어를 직접 받는다. */
export function useStore<T>(store: StoreApi<T>): T;
export function useStore<T, U>(store: StoreApi<T>, selector: (state: T) => U): U;
export function useStore<T, U>(store: StoreApi<T>, selector?: (state: T) => U): U {
    const select = (selector ?? ((state: T) => state)) as (state: T) => U;
    return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}

export interface StoreHook<T> extends StoreApi<T> {
    (): T;
    <U>(selector: (state: T) => U): U;
}

/** zustand create의 preact 판 - 돌려진 훅에 getState/setState/subscribe가 붙어 명령형 호출부가 그대로 작동한다. */
export const create = <T>(initializer: (set: StoreApi<T>["setState"], get: StoreApi<T>["getState"], api: StoreApi<T>) => T): StoreHook<T> => {
    const store = createStore(initializer);
    const hook = (<U,>(selector?: (state: T) => U): U => useStore(store, selector as (state: T) => U)) as StoreHook<T>;
    hook.getState = store.getState;
    hook.setState = store.setState;
    hook.subscribe = store.subscribe;
    hook.getInitialState = store.getInitialState;
    return hook;
};
