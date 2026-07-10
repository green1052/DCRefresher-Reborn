import {type App, createApp} from "vue";

import frameRoot from "./frameComponent.vue";
import {type FrameOptions, PreviewFrame} from "./PreviewFrame";

export type {FrameOptions, FrameData, FrameFunctions} from "./PreviewFrame";

export interface FrameStackOption {
    background?: boolean;
    onScroll?: (ev: WheelEvent, group: HTMLElement) => void;
    blur?: boolean;
}

export interface FrameScrollApi {
    setScrollMode: (mode: "top" | "bottom" | "none") => void;
    clearScrollMode: () => void;
    body: () => PreviewFrame;
    comment: () => PreviewFrame;
    close: () => void;
    fadeIn: () => void;
    fadeOut: () => void;
    closed: boolean;
    inputFocus: boolean;
    groupElement: HTMLElement | undefined;
    bodyFrameRef: { incrementCommentKey?: () => void } | null;
    commentFrameRef: { incrementCommentKey?: () => void } | null;
    onClose: (handler: () => void) => void;
}

export default class Frame {
    readonly frames: PreviewFrame[];
    readonly app: FrameScrollApi;
    private readonly rootElement: HTMLElement;
    private readonly vueApp: App<Element>;

    constructor(children: FrameOptions[], option: FrameStackOption) {
        if (document.readyState === "loading") {
            throw new Error("Frame is not available before DOMContentLoaded event. (DOM isn't accessible)");
        }

        this.frames = children.map((child) => new PreviewFrame(child));

        this.rootElement = document.createElement("refresher-frame-outer");
        document.body.appendChild(this.rootElement);

        this.vueApp = createApp(frameRoot, {
            frames: this.frames,
            option
        });

        const mounted = this.vueApp.mount(this.rootElement) as unknown as FrameScrollApi;
        this.app = mounted;
    }

    destroy(): void {
        this.vueApp.unmount();
        this.rootElement.remove();
    }
}