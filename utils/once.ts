/** 비동기 초기화를 한 번만 실행한다. 동시 호출은 같은 Promise를 기다리고, 실패하면 비워 두어 다음 호출이 다시 시도한다 */
export const once = <T>(run: () => Promise<T>): (() => Promise<T>) => {
    let pending: Promise<T> | null = null;
    return () => (pending ??= run().catch((e: unknown) => {
        pending = null;
        throw e;
    }));
};
