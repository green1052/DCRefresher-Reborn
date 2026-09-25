interface Filter {
    scope: string;
    callback: (element: HTMLElement) => void;
}

const filters = new Set<Filter>();

let observer: MutationObserver | null = null;

// 잘못된 selector가 들어와도 필터 전체가 죽지 않도록 감싼다
const queryAll = (root: Element, scope: string): HTMLElement[] => {
    try {
        return Array.from(root.querySelectorAll<HTMLElement>(scope));
    } catch {
        return [];
    }
};

const run = (filter: Filter, element: HTMLElement): void => {
    try {
        filter.callback(element);
    } catch (e) {
        console.error(`Filter "${filter.scope}" failed:`, e);
    }
};

// 추가된 요소 자신 → 조상(추가된 자식 때문에 조건을 새로 만족한 부모) → 자손 순으로 수집
const collect = (element: HTMLElement, scope: string, matches: Set<HTMLElement>): void => {
    try {
        if (element.matches(scope)) matches.add(element);
        const parent = element.parentElement?.closest<HTMLElement>(scope);
        if (parent) matches.add(parent);
    } catch {
        return;
    }

    for (const match of queryAll(element, scope)) matches.add(match);
};

// 옵저버가 한 번에 넘기는 mutation 묶음을 한꺼번에 처리
// userinfo가 작성자마다 넣는 배지 묶음은 건너뛴다 — closest로 부모 작성자가 다시 잡혀 행마다 모든 필터(차단 정규식 등)가 한 번 더 돈다
const flush = (mutations: MutationRecord[]): void => {
    const added = mutations
        .flatMap((mutation) => Array.from(mutation.addedNodes))
        .filter((node): node is HTMLElement => node instanceof HTMLElement && !node.classList.contains("refresher-user-badges"));
    if (added.length === 0) return;

    for (const filter of filters) {
        const matches = new Set<HTMLElement>();
        for (const element of added) collect(element, filter.scope, matches);
        for (const element of matches) run(filter, element);
    }
};

/**
 * scope에 맞는 요소마다 callback 실행 — 지금 있는 요소는 즉시, 이후 추가되는 요소는 추가될 때.
 * 같은 요소에 여러 번 불릴 수 있으므로 callback은 멱등이어야 한다. 해제 함수를 반환한다.
 */
export const addFilter = (scope: string, callback: (element: HTMLElement) => void): (() => void) => {
    const filter: Filter = {scope, callback};
    filters.add(filter);

    for (const element of queryAll(document.documentElement, scope)) run(filter, element);

    observer ??= new MutationObserver(flush);
    observer.observe(document.documentElement, {childList: true, subtree: true});

    return () => {
        filters.delete(filter);
        if (filters.size > 0 || !observer) return;
        observer.disconnect();
        observer = null;
    };
};
