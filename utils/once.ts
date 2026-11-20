/** 비동기 초기화를 한 번만 실행. 실패하면 비워 다시 시도한다. */
export const once = <A extends unknown[], T>(run: (...args: A) => Promise<T>): ((...args: A) => Promise<T>) => {
    let pending: Promise<T> | null = null;
    return (...args) => (pending ??= run(...args).catch((e: unknown) => {
        pending = null;
        throw e;
    }));
};
