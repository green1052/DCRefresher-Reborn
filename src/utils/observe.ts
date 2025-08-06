export const find = (element: string, parent: HTMLElement): Promise<NodeListOf<HTMLElement>> =>
    new Promise<NodeListOf<HTMLElement>>((resolve, reject) => {
        let observer: MutationObserver | null = null;

        const timeout = window.setTimeout(() => {
            observer?.disconnect();
            reject(`Couldn't find the element(${element}).`);
        }, 3000);

        observer = listen(element, parent, function (this: MutationObserver, elements) {
            observer?.disconnect();

            if (timeout) window.clearTimeout(timeout);

            resolve(elements);
        });
    });

export const listen = (
    element: string,
    parent: HTMLElement,
    callback: (element: NodeListOf<HTMLElement>) => void
): MutationObserver => {
    const parentFind = parent.querySelectorAll<HTMLElement>(element);

    if (parentFind.length > 0) callback(parentFind);

    const observer = new MutationObserver(function (this: MutationObserver, mutations) {
        let executed = false;

        for (const mutation of mutations) {
            if (mutation.addedNodes.length === 0) continue;
            executed = true;
            break;
        }

        if (!executed) return;

        const lists = document.querySelectorAll<HTMLElement>(element);

        if (lists.length === 0) return;

        callback.bind(this)(lists);
    });

    observer.observe(parent ?? document.documentElement, {
        childList: true,
        subtree: true
    });

    return observer;
};

export default {
    find,
    listen
};
