export type InsertPosition = "before" | "after" | "append" | "prepend";

export interface InsertOptions {
    position?: InsertPosition;
    relativeSelector?: string;
}

export function appendUserDataSpan(element: HTMLElement, span: HTMLElement, options: InsertOptions = {}): boolean {
    const {position = "append", relativeSelector} = options;

    let target: HTMLElement | null = element;

    if (relativeSelector) {
        target = element.querySelector<HTMLElement>(relativeSelector);
        if (!target) return false;
    }

    switch (position) {
        case "before": {
            const ref = target.querySelector<HTMLElement>(".refresherUserData");
            if (ref) target.insertBefore(span, ref);
            else target.prepend(span);
            break;
        }
        case "after": {
            const ref = target.querySelector<HTMLElement>(".refresherUserData");
            if (ref) ref.after(span);
            else target.appendChild(span);
            break;
        }
        case "prepend":
            target.prepend(span);
            break;
        case "append":
        default:
            target.appendChild(span);
            break;
    }

    return true;
}

export function insertIntoWriterArea(element: HTMLElement, span: HTMLElement): boolean {
    if (element.dataset.ip) {
        const addBox = element.querySelector<HTMLElement>(".addbox");

        if (addBox) {
            const fl = element.querySelector<HTMLElement>(".fl > span");
            if (fl) {
                const ip = fl.querySelector<HTMLElement>(".ip");
                if (ip) fl.insertBefore(span, ip);
                else fl.appendChild(span);
            } else {
                const ip = element.querySelector<HTMLElement>(".ip");
                if (ip) {
                    const userData = ip.querySelector<HTMLElement>(".refresherUserData");
                    if (userData) ip.insertBefore(span, userData);
                    else ip.appendChild(span);
                } else {
                    addBox.appendChild(span);
                }
            }
            return true;
        }

        const fl = element.querySelector<HTMLElement>(".fl > span");
        if (fl) {
            const flIpQuery = fl.querySelector<HTMLElement>(".ip, .writer_nikcon");
            if (flIpQuery) fl.insertBefore(span, flIpQuery.nextSibling);
            else fl.appendChild(span);
            return true;
        }

        const userData = element.querySelector<HTMLElement>(".refresherUserData");
        if (userData) element.insertBefore(span, userData);
        else element.appendChild(span);
        return true;
    }

    const addBox = element.querySelector<HTMLElement>(".addbox");
    if (addBox) {
        const userData = element.querySelector<HTMLElement>(".refresherUserData");
        if (userData) addBox.insertBefore(span, userData);
        else addBox.appendChild(span);
        return true;
    }

    element.appendChild(span);
    return true;
}