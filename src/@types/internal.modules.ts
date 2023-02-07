import type { Nullable } from "../utils/types";

export {};

declare global {
    interface MiniPreview {
        element: HTMLDivElement;
        init: boolean;
        lastRequest: number;
        controller: AbortController;
        lastElement: Nullable<EventTarget>;
        lastTimeout: number;
        shouldOutHandle: boolean;
        cursorOut: boolean;

        create: (ev: MouseEvent, use: boolean, hide: boolean) => void;
        move: (ev: MouseEvent, use: boolean) => void;
        close: (use: boolean) => void;
    }
}