/**
 * 주어진 element의 자식들을 모두 탐색합니다.
 *
 * @param element 탐색할 element.
 */
export const traversal = (element: HTMLElement): HTMLElement[] => {
    const result = [];

    if (element.nodeType !== Node.ELEMENT_NODE) {
        return [];
    }

    const childs = element.children;
    const child_len = childs.length;

    result.push(element);

    for (let i = 0; i < child_len; i++) {
        const child = childs[i] as HTMLElement;

        const travel = traversal(child);
        if (travel.length) {
            result.push(...travel);
        }
    }

    return result;
};

/**
 * 인근 Element 들을 탐색합니다.
 * @param el 검색을 시작할 Element
 * @param find 찾을 Element의 HTML Selector
 * @param max 최대 깊이
 * @param current 현재 깊이 (내부용)
 */
export const findNeighbor = (
    el: HTMLElement,
    find: string,
    max: number,
    current: number | null
): HTMLElement | null => {
    if (!find) {
        return null;
    }

    if (current && current > max) {
        return null;
    }

    if (!current) {
        current = 0;
    }

    if (el.parentElement) {
        if (el.parentElement && el.parentElement.parentElement) {
            const qsa = el.parentElement.parentElement.querySelectorAll(find);

            if (qsa && qsa.length && Array.from(qsa).includes(el.parentElement)) {
                return el.parentElement;
            }
        }

        const query = el.parentElement.querySelector(find) as HTMLElement;

        if (!query) {
            current++;

            return findNeighbor(el.parentElement, find, max, current);
        }

        return query;
    }

    return null;
};