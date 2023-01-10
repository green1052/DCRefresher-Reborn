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
    title: string;
    subtitle: string;
    comments: DcinsideComments | Record<string, unknown>;
    functions: {
        [index: string]: (...args: any[]) => boolean | Promise<boolean>
    };

    options: FrameOption;
    app: RefresherFrameAppVue;
    data: { [index: string]: unknown };

    contents: string;
    collapse?: boolean;
    error: Error | boolean;
    upvotes: string | null;
    downvotes: string | null;
    fixedUpvotes: string | null;
    buttonError: unknown;

    constructor(options: FrameOption, app: RefresherFrameAppVue) {
        this.options = options;

        this.title = "";
        this.subtitle = "";
        this.comments = {};
        this.functions = {};
        this.collapse = false;

        this.app = app;
        this.data = {};

        this.error = false;
        this.contents = "";
        this.upvotes = null;
        this.downvotes = null;
        this.fixedUpvotes = null;
        this.buttonError = null;
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
        if (!document || !document.createElement) {
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
        }).$children[0];

        for (let i = 0; i < children.length; i++) {
            this.app.frames.push(new InternalFrame(children[i], this.app));
        }
    }
}