interface FilterEntry {
    func: (element: HTMLElement) => void;
    scope: string;
    options?: RefresherFilteringOptions;
    expire?: () => void;
}

const lists = new Map<string, FilterEntry>();
const neverExpireIds = new Set<string>();

let sharedObserver: MutationObserver | null = null;

// 배치 처리: mutation을 큐에 모아두고 microtask에서 한 번에 처리
let pendingMutations: MutationRecord[] = [];
let flushScheduled = false;

// 잘못된 selector가 들어와도 필터 전체가 죽지 않도록 감싼다.
const matchesSelector = (el: HTMLElement, scope: string): boolean => {
    try {
        return el.matches(scope);
    } catch {
        return false;
    }
};

const collectAddedElements = (mutations: MutationRecord[]): HTMLElement[] => {
    const elements: HTMLElement[] = [];

    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
                elements.push(node);
            }
        }
    }

    return elements;
};

// 단일 패스 매칭: 모든 neverExpire 필터를 added elements에 대해 한 번에 순회
const matchAllScopes = (
    addedElements: HTMLElement[]
): Map<string, Set<HTMLElement>> => {
    const result = new Map<string, Set<HTMLElement>>();

    if (neverExpireIds.size === 0 || addedElements.length === 0) return result;

    const scopes: { id: string; scope: string }[] = [];
    for (const id of neverExpireIds) {
        const entry = lists.get(id);
        if (!entry) continue;
        scopes.push({id, scope: entry.scope});
    }

    for (const el of addedElements) {
        for (const {id, scope} of scopes) {
            let matches = result.get(id);
            if (!matches) {
                matches = new Set();
                result.set(id, matches);
            }

            // 1. el 자체가 scope에 매칭
            if (matchesSelector(el, scope)) {
                matches.add(el);
            }

            // 2. el의 자손 중 scope에 매칭
            let descendants: NodeListOf<HTMLElement> | undefined;
            try {
                descendants = el.querySelectorAll<HTMLElement>(scope);
            } catch {
                // invalid selector - skip
            }
            if (descendants) {
                for (const matched of descendants) {
                    matches.add(matched);
                }
            }

            // 3. el의 조상 중 scope에 매칭 (closest)
            const matchingParent = el.parentElement?.closest<HTMLElement>(scope);
            if (matchingParent) {
                matches.add(matchingParent);
            }
        }
    }

    return result;
};

const runFilter = (entry: FilterEntry, elements: Iterable<HTMLElement>): void => {
    for (const element of elements) {
        entry.func(element);
    }
};

// 배치 처리 플러시: 큐에 모인 mutation을 한 번에 처리
const flushPendingMutations = (): void => {
    flushScheduled = false;
    if (pendingMutations.length === 0) return;

    const mutations = pendingMutations;
    pendingMutations = [];

    const addedElements = collectAddedElements(mutations);
    if (addedElements.length === 0) return;

    const matchesByFilter = matchAllScopes(addedElements);

    for (const [id, matches] of matchesByFilter) {
        const entry = lists.get(id);
        if (!entry || matches.size === 0) continue;
        runFilter(entry, matches);
    }
};

const scheduleFlush = (): void => {
    if (flushScheduled) return;
    flushScheduled = true;
    // microtask로 배치 처리 (Promise.resolve().then과 동등)
    queueMicrotask(flushPendingMutations);
};

const ensureSharedObserver = (): void => {
    if (sharedObserver) return;

    sharedObserver = new MutationObserver((mutations) => {
        // mutation을 큐에 적재 후 microtask에서 배치 처리
        pendingMutations.push(...mutations);
        scheduleFlush();
    });

    sharedObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
};

const teardownSharedObserver = (): void => {
    if (neverExpireIds.size > 0 || !sharedObserver) return;
    sharedObserver.disconnect();
    sharedObserver = null;
    pendingMutations = [];
    flushScheduled = false;
};

const setupNeverExpire = (id: string): void => {
    const entry = lists.get(id);
    if (!entry) return;

    const existing = document.documentElement.querySelectorAll<HTMLElement>(entry.scope);
    if (existing.length > 0) {
        runFilter(entry, existing);
    }

    neverExpireIds.add(id);
    ensureSharedObserver();

    entry.expire = () => {
        neverExpireIds.delete(id);
        teardownSharedObserver();
    };
};

const findElements = (scope: string, parent: HTMLElement): Promise<Iterable<HTMLElement>> =>
    new Promise<Iterable<HTMLElement>>((resolve, reject) => {
        const existing = parent.querySelectorAll<HTMLElement>(scope);
        if (existing.length > 0) {
            resolve(existing);
            return;
        }

        let observer: MutationObserver | null = null;

        const timeout = window.setTimeout(() => {
            observer?.disconnect();
            reject(`Couldn't find the element(${scope}).`);
        }, 3000);

        observer = new MutationObserver((mutations) => {
            const addedElements = collectAddedElements(mutations);
            if (addedElements.length === 0) return;

            const matches = new Set<HTMLElement>();

            for (const el of addedElements) {
                if (matchesSelector(el, scope)) matches.add(el);

                try {
                    for (const matched of el.querySelectorAll<HTMLElement>(scope)) {
                        matches.add(matched);
                    }
                } catch {
                    // invalid selector
                }

                const matchingParent = el.parentElement?.closest<HTMLElement>(scope);
                if (matchingParent) matches.add(matchingParent);
            }

            if (matches.size > 0) {
                observer?.disconnect();
                window.clearTimeout(timeout);
                resolve(matches);
            }
        });

        observer.observe(parent, {
            childList: true,
            subtree: true
        });
    });

export const filter = {
    ids: (): string[] => Array.from(lists.keys()),

    run: async (): Promise<void> => {
        const oneShotEntries = Array.from(lists.entries()).filter(
            ([, entry]) => !entry.options?.neverExpire
        );

        const neverExpireEntries = Array.from(lists.entries()).filter(
            ([, entry]) => entry.options?.neverExpire
        );

        for (const [id, entry] of neverExpireEntries) {
            entry.expire?.();
            setupNeverExpire(id);
        }

        await Promise.all(
            oneShotEntries.map(async ([, entry]) => {
                try {
                    const elements = await findElements(entry.scope, document.documentElement);
                    runFilter(entry, elements);
                } catch (e) {
                    if (!entry.options?.skipIfNotExists) throw e;
                }
            })
        );
    },

    runSpecific: (id: string): Promise<void> => {
        const entry = lists.get(id);
        if (!entry) return Promise.resolve();

        if (entry.options?.neverExpire) {
            entry.expire?.();
            setupNeverExpire(id);
            return Promise.resolve();
        }

        return findElements(entry.scope, document.documentElement).then((e) => runFilter(entry, e));
    },

    add: <T = HTMLElement>(
        scope: string,
        callback: (element: T) => void,
        options?: RefresherFilteringOptions
    ): string => {
        const uuid = crypto.randomUUID();

        lists.set(uuid, {
            func: callback as (element: HTMLElement) => void,
            scope,
            options
        });

        return uuid;
    },

    remove: (uuid: string, skip?: boolean): void => {
        if (!uuid) {
            if (skip) return;
            throw new Error("Given UUID is not valid.");
        }

        const entry = lists.get(uuid);
        if (!entry) {
            if (skip) return;
            throw new Error("Given UUID is not exists in the list.");
        }

        if (entry.options?.neverExpire && typeof entry.expire === "function") {
            entry.expire();
        }

        lists.delete(uuid);
    }
};

export default filter;
