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

const isValidSelector = (scope: string): boolean => {
    try {
        document.createDocumentFragment().querySelector(scope);
        return true;
    } catch {
        return false;
    }
};

// 모든 필터 선택자를 합친 선택자 (잘못된 선택자는 뺀다). 어느 필터에도 맞지 않는 덩어리를 필터별로 훑기 전에 걸러 낸다.
let union: string | null = null;
const rebuildUnion = (): void => {
    const scopes = [...filters].map((filter) => filter.scope).filter(isValidSelector);
    union = scopes.length > 0 ? scopes.join(", ") : null;
};

// 옵저버가 넘기는 mutation 묶음을 한 번에 처리한다. 추가된 요소 자신·자손과, 자식이 붙어 조건을 새로 만족했을 수 있는 조상을 본다.
// 문서를 읽는 동안에는 한 묶음에 노드가 수천 개라 노드마다 필터를 돌리면 콜백보다 훑기가 더 오래 걸린다. 그래서 가장 바깥 덩어리만 훑는다.
// userinfo가 작성자마다 넣는 배지 묶음은 건너뛴다. closest로 작성자 요소가 다시 잡혀 행마다 모든 필터(차단 정규식 등)가 한 번 더 돌기 때문이다.
const flush = (mutations: MutationRecord[]): void => {
    const added = new Set<HTMLElement>();
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            // 같은 묶음 안에서 다시 빠진 노드는 볼 것이 없다
            if (node instanceof HTMLElement && node.isConnected && !node.classList.contains("refresher-user-badges")) added.add(node);
        }
    }
    if (added.size === 0) return;

    // 함께 추가된 조상 안에 든 노드는 그 조상을 훑을 때 잡힌다
    const roots = [...added].filter((node) => {
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            if (added.has(parent)) return false;
        }
        return true;
    });
    // 조상 검사는 부모마다 한 번만 한다. 파서는 같은 부모 아래에 행을 줄줄이 넣는다
    const parents = new Set<HTMLElement>();
    for (const root of roots) if (root.parentElement) parents.add(root.parentElement);
    const candidates = union ? roots.filter((root) => root.matches(union!) || root.querySelector(union!) !== null) : roots;

    for (const filter of filters) {
        const matches = new Set<HTMLElement>();
        try {
            for (const root of candidates) {
                if (root.matches(filter.scope)) matches.add(root);
                for (const match of root.querySelectorAll<HTMLElement>(filter.scope)) matches.add(match);
            }
            for (const parent of parents) {
                const match = parent.closest<HTMLElement>(filter.scope);
                if (match) matches.add(match);
            }
        } catch {
            // 잘못된 선택자는 이 필터만 건너뛴다
            continue;
        }
        for (const element of matches) run(filter, element);
    }
};

/**
 * scope에 맞는 요소마다 callback을 부른다. 지금 있는 요소는 바로, 이후 추가되는 요소는 추가될 때 부른다.
 * 같은 요소에 여러 번 불릴 수 있으므로 callback은 멱등이어야 한다. 해제 함수를 반환한다.
 */
export const addFilter = (scope: string, callback: (element: HTMLElement) => void): (() => void) => {
    const filter: Filter = {scope, callback};
    filters.add(filter);
    rebuildUnion();

    for (const element of queryAll(document.documentElement, scope)) run(filter, element);

    observer ??= new MutationObserver(flush);
    observer.observe(document.documentElement, {childList: true, subtree: true});

    return () => {
        filters.delete(filter);
        rebuildUnion();
        if (filters.size > 0 || !observer) return;
        observer.disconnect();
        observer = null;
    };
};
