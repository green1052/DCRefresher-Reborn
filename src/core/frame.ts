import Vue from "vue";
import frame from "./frameComponent.vue";

interface FrameOption {
    relative?: boolean;
    center?: boolean;
    preview?: boolean;
    blur?: boolean;
}

interface FrameStackOption {
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
    comments: dcinsideComments | Record<string, unknown>;
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
        this.buttonError = null;
    }

    querySelector(a: string) {
        return this.app.$el.querySelector(a);
    }

    querySelectorAll(a: string) {
        return this.app.$el.querySelectorAll(a);
    }

    get center() {
        return this.options.center;
    }
}

export default class {
    outer: HTMLElement;
    frame: RefresherFrame[];
    app: RefresherFrameAppVue;

    constructor(childs: Array<FrameOption>, option: FrameStackOption) {
        if (!document || !document.createElement) {
            throw new Error(
                "Frame is not available before DOMContentLoaded event. (DOM isn't accessible)"
            );
        }

        if (!childs) {
            childs = [];
        }

        if (typeof option === "undefined") {
            option = {};
        }

        this.outer = document.createElement("refresher-frame-outer");
        document.body.appendChild(this.outer);

        this.frame = [];
        this.app = new Vue({
            el: this.outer,
            render: h => h(frame, {
                props: {
                    option
                }
            })
        }).$children[0];

        for (let i = 0; i < childs.length; i++) {
            this.app.frames.push(new InternalFrame(childs[i], this.app));
        }

        const keyupFunction = (ev: KeyboardEvent) => {
            if (ev.code === "Escape") {
                this.app.outerClick();
            }

            document.removeEventListener("keyup", keyupFunction);
        };
        document.addEventListener("keyup", keyupFunction);

        document.body.style.overflow = "hidden";

        if (option && option.onScroll) {
            const refresherGroup = this.app.$el.querySelector(".refresher-group");

            if (!refresherGroup) {
                return;
            }

            refresherGroup.addEventListener("wheel", ev => {
                if (option.onScroll) {
                    option.onScroll(ev as WheelEvent, this.app, refresherGroup as HTMLElement);
                }
            });
        }
    }
}