import {type App, createApp} from "vue";

import frameRoot from "./frameComponent.vue";

export interface FrameOption {
    relative?: boolean;
    center?: boolean;
    preview?: boolean;
    blur?: boolean;
}

export type FrameScrollApi = Pick<
    RefresherFrameAppVue,
    "setScrollMode" | "clearScrollMode" | "body" | "comment" | "close" | "fadeIn" | "$on"
> &
    Partial<Pick<RefresherFrameAppVue, "closed" | "commentFrameRef">>;

export interface FrameStackOption {
    background?: boolean;
    onScroll?: (ev: WheelEvent, app: FrameScrollApi, group: HTMLElement) => void;
    blur?: boolean;
}

export default class Frame {
    readonly app: RefresherFrameAppVue;
    private readonly rootElement: HTMLElement;
    private readonly vueApp: App;

    constructor(children: FrameOption[], option: FrameStackOption) {
        if (document.readyState === "loading") {
            throw new Error("Frame is not available before DOMContentLoaded event. (DOM isn't accessible)");
        }

        this.rootElement = document.createElement("refresher-frame-outer");
        document.body.appendChild(this.rootElement);

        this.vueApp = createApp(frameRoot, {option, children});
        this.app = this.vueApp.mount(this.rootElement) as RefresherFrameAppVue;
    }

    destroy(): void {
        this.vueApp.unmount();
        this.rootElement.remove();
    }
}
