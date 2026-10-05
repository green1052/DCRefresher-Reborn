/**
 * 동시 실행 수 제한. 넘치는 작업은 차례대로 기다린다.
 * 실행 중에 setConcurrency로 늘리면 기다리던 작업이 바로 그만큼 시작하고, 줄이면 도는 작업이 끝날 때부터 따른다.
 */
export const createLimiter = (initial: number) => {
    let concurrency = initial;
    let active = 0;
    const queue: (() => void)[] = [];

    const next = (): void => {
        while (active < concurrency && queue.length > 0) {
            active++;
            queue.shift()!();
        }
    };

    return {
        /** task를 차례가 오면 실행한다. task가 바로 던져도 거절된 Promise로 돌려준다. */
        run: <T>(task: () => Promise<T>): Promise<T> =>
            new Promise<T>((resolve, reject) => {
                queue.push(() => {
                    (async () => task())().then(resolve, reject).finally(() => {
                        active--;
                        next();
                    });
                });
                next();
            }),

        /** 1 이상의 정수나 Infinity여야 한다. */
        setConcurrency: (value: number): void => {
            if (!(value === Number.POSITIVE_INFINITY || (Number.isInteger(value) && value > 0))) throw new TypeError(`동시 실행 수가 올바르지 않습니다: ${value}`);
            concurrency = value;
            next();
        },

        get activeCount(): number {
            return active;
        },
        get pendingCount(): number {
            return queue.length;
        }
    };
};
