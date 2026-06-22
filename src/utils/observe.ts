export const find = (element: string, parent: HTMLElement): Promise<Iterable<HTMLElement>> =>
    new Promise<Iterable<HTMLElement>>((resolve, reject) => {
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
    callback: (elements: Iterable<HTMLElement>) => void
): MutationObserver => {
    const parentFind = parent.querySelectorAll<HTMLElement>(element);

    if (parentFind.length > 0) callback(parentFind);

    const observer = new MutationObserver((mutations) => {
        const matches = new Set<HTMLElement>();

        for (const mutation of mutations) {
            for (const addedNode of mutation.addedNodes) {
                const addedElement =
                    addedNode instanceof HTMLElement ? addedNode : addedNode.parentElement;

                if (!addedElement) continue;

                if (addedElement.matches(element)) {
                    matches.add(addedElement);
                }

                for (const matchedElement of addedElement.querySelectorAll<HTMLElement>(element)) {
                    matches.add(matchedElement);
                }

                const matchingParent = addedElement.parentElement?.closest<HTMLElement>(element);
                if (matchingParent) {
                    matches.add(matchingParent);
                }
            }
        }

        if (matches.size > 0) {
            callback(matches);
        }
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
