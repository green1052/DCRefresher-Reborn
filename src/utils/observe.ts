export const find = (elem: string, parent: HTMLElement): Promise<NodeListOf<HTMLElement>> =>
    new Promise<NodeListOf<HTMLElement>>((resolve, reject) => {
        let timeout: number | null = null;

        var observer = listen(elem, parent, (elements) => {
            observer?.disconnect();

            if (timeout) window.clearTimeout(timeout);

            resolve(elements);
        });

        timeout = window.setTimeout(() => {
            observer?.disconnect();

            reject(`Couldn't find the element(${elem}).`);
        }, 3000);
    });

export const listen = (
    elem: string,
    parent: HTMLElement,
    callback: (element: NodeListOf<HTMLElement>) => void
): MutationObserver => {
    const parentFind = parent.querySelectorAll<HTMLElement>(elem);

    if (parentFind.length > 0) callback(parentFind);

    const observer = new MutationObserver((mutations) => {
        let executed = false;

        for (const mutation of mutations) {
            if (mutation.addedNodes.length === 0) continue;
            executed = true;
            break;
        }

        if (!executed) return;

        const lists = document.querySelectorAll<HTMLElement>(elem);

        if (lists.length === 0) return;

        callback(lists);
    });

    observer.observe(parent ?? document.documentElement, {
        childList: true,
        subtree: true
    });

    return observer;
};
