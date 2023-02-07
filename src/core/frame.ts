import Vue from "vue";
import frame from "./frameComponent.vue";

interface FrameOption {
    relative?: boolean;
    center?: boolean;
    preview?: boolean;
    blur?: boolean;
}

export interface FrameStackOption {
    background?: boolean;
    stack?: boolean;
    groupOnce?: boolean;
    onScroll?: (
        ev: WheelEvent,
        app: RefresherFrameAppVue,
        group: HTMLElement
    ) => void;
    blur?: boolean;
}

class InternalFrame implements RefresherFrame {
    app: RefresherFrameAppVue;
    collapse: boolean | undefined;
    contents: string | undefined;
    downvotes: string | undefined;
    error: { title: string; detail: string } | undefined;
    fixedUpvotes: string | undefined;

    subtitle: string;
    title: string;
    upvotes: string | undefined;
    functions;
    data;

    constructor(public options: FrameOption, app: RefresherFrameAppVue) {
        this.options = options;

        this.title = "";
        this.subtitle = "";

        this.app = app;

        this.data = {};
        this.functions = {};
    }

    get center() {
        return this.options.center;
    }

    querySelector(selectors: string) {
        return this.app.$el.querySelector(selectors);
    }

    querySelectorAll(selectors: string) {
        return this.app.$el.querySelectorAll(selectors);
    }
}

export default class {
    outer: HTMLElement;
    frame: RefresherFrame[];
    app: RefresherFrameAppVue;

    constructor(children: FrameOption[], option: FrameStackOption) {
        if (document.readyState === "loading") {
            throw "Frame is not available before DOMContentLoaded event. (DOM isn't accessible)";
        }

        this.outer = document.createElement("refresher-frame-outer");
        document.body.appendChild(this.outer);

        this.frame = [];
        this.app = new Vue({
            el: this.outer,
            render: (h) => h(frame, {
                props: {
                    option
                }
            })
        }).$children[0] as RefresherFrameAppVue;

        for (const child of children) {
            this.app.frames.push(new InternalFrame(child, this.app));
        }
    }
}