interface FilterEntry {
    func: (element: HTMLElement) => void;
    scope: string;
    options?: RefresherFilteringOptions;
    expire?: () => void;
}

const lists = new Map<string, FilterEntry>();
const neverExpireIds = new Set<string>();

let sharedObserver: MutationObserver | null = null;

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

const matchScope = (addedElements: HTMLElement[], scope: string): Set<HTMLElement> => {
    const matches = new Set<HTMLElement>();

    for (const el of addedElements) {
        if (el.matches(scope)) {
            matches.add(el);
        }

        for (const matched of el.querySelectorAll<HTMLElement>(scope)) {
            matches.add(matched);
        }

        const matchingParent = el.parentElement?.closest<HTMLElement>(scope);
        if (matchingParent) {
            matches.add(matchingParent);
        }
    }

    return matches;
};

const runFilter = async (entry: FilterEntry, elements: Iterable<HTMLElement>): Promise<void> => {
    for (const element of elements) {
        entry.func(element);
    }
};

const ensureSharedObserver = (): void => {
    if (sharedObserver) return;

    sharedObserver = new MutationObserver((mutations) => {
        const addedElements = collectAddedElements(mutations);
        if (addedElements.length === 0) return;

        for (const id of neverExpireIds) {
            const entry = lists.get(id);
            if (!entry) continue;

            const matches = matchScope(addedElements, entry.scope);
            if (matches.size > 0) {
                void runFilter(entry, matches);
            }
        }
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
};

const setupNeverExpire = (id: string): void => {
    const entry = lists.get(id);
    if (!entry) return;

    const existing = document.documentElement.querySelectorAll<HTMLElement>(entry.scope);
    if (existing.length > 0) {
        void runFilter(entry, existing);
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

            const matches = matchScope(addedElements, scope);
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
                    await runFilter(entry, elements);
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