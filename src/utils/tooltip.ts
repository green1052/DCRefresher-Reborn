export interface TooltipState {
    element: HTMLDivElement;
    init: boolean;
    lastRequest: number;
    controller: AbortController;
    lastElement: EventTarget | null;
    lastTimeout: number;
    shouldOutHandle: boolean;
    cursorOut: boolean;
}

export function createTooltip(): TooltipState {
    return {
        element: document.createElement("div"),
        init: false,
        lastRequest: 0,
        controller: new AbortController(),
        lastElement: null,
        lastTimeout: 0,
        shouldOutHandle: false,
        cursorOut: false
    };
}

export function tooltipCreate(state: TooltipState, ev: MouseEvent, use: boolean): void {
    if (!use) return;

    state.cursorOut = false;

    if (Date.now() - state.lastRequest < 150) {
        state.lastRequest = Date.now();
        state.lastElement = ev.target;

        if (state.lastTimeout) clearTimeout(state.lastTimeout);

        state.lastTimeout = window.setTimeout(() => {
            if (!state.cursorOut && state.lastElement === ev.target) {
                tooltipCreate(state, ev, use);
            }
            state.cursorOut = false;
        }, 150);

        return;
    }

    state.lastRequest = Date.now();

    state.element.classList.remove("hide");
    state.element.classList.add("refresher-tooltip");

    if (!state.init) {
        document.body.appendChild(state.element);
        state.init = true;
    }

    state.element.innerHTML = `<p>${Array.from((ev.target as HTMLElement).querySelectorAll<HTMLElement>(".refresherUserData[title]"))
        .map((e) => e?.outerHTML)
        .join(" ")}</p>`;
}

export function tooltipMove(state: TooltipState, ev: MouseEvent, use: boolean): void {
    if (!use) return;

    const rect = state.element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = Math.min(ev.clientX, innerWidth - width - 10);
    const y = Math.min(ev.clientY, innerHeight - height - 10);

    state.element.style.transform = `translate(${x}px, ${y}px)`;
}

export function tooltipClose(state: TooltipState, use: boolean): void {
    state.cursorOut = true;

    if (use) {
        state.controller.abort();
        state.controller = new AbortController();
    }

    state.element.classList.add("hide");
}