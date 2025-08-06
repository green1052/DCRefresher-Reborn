import { createApp } from "vue";

import { User } from "../utils/user";
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
    onScroll?: (ev: WheelEvent, app: RefresherFrameAppVue, group: HTMLElement) => void;
    blur?: boolean;
}

class InternalFrame implements RefresherFrame {
    title = "";
    subtitle = "";
    contents: string | undefined = undefined;
    upvotes: string | undefined = undefined;
    fixedUpvotes: string | undefined = undefined;
    downvotes: string | undefined = undefined;
    error?: { title: string; detail: string } | undefined = undefined;
    collapse?: boolean = undefined;
    data: {
        load: boolean;
        buttons: boolean;
        disabledDownvote: boolean;
        user: User | undefined;
        date: Date | undefined;
        expire: string | undefined;
        views: string | undefined;
        useWriteComment: boolean;
        comments: DcinsideComments | undefined;
    };
    functions: {
        vote(type: number): Promise<boolean>;
        share(): boolean;
        load(useCache?: boolean): void;
        retry(useCache?: boolean): void;
        openOriginal(): boolean;
        writeComment(
            type: "text" | "dccon",
            memo: string | DcinsideDccon,
            reply: string | null,
            user: { name: string; pw?: string }
        ): Promise<boolean>;
        deleteComment(commentId: string, password: string, admin: boolean): Promise<boolean>;
    };

    private eventListeners: Map<string, Function[]> = new Map();

    constructor(
        public options: FrameOption,
        public app: RefresherFrameAppVue
    ) {
        this.data = {};
        this.functions = {};
    }

    get center() {
        return this.options.center;
    }

    querySelector<T extends Element = Element>(selectors: string) {
        return this.app.$el.querySelector<T>(selectors);
    }

    querySelectorAll<T extends Element = Element>(selectors: string) {
        return this.app.$el.querySelectorAll<T>(selectors);
    }

    // Event emitter methods for Vue 3 compatibility
    $on(event: string, callback: Function) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    $emit(event: string, ...args: any[]) {
        const callbacks = this.eventListeners.get(event);
        if (callbacks) {
            callbacks.forEach((callback) => callback(...args));
        }
    }

    $off(event: string, callback?: Function) {
        if (!callback) {
            this.eventListeners.delete(event);
            return;
        }

        const callbacks = this.eventListeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
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
        const app = createApp(frame, { option });
        this.app = app.mount(this.outer) as RefresherFrameAppVue;

        for (const child of children) {
            const internalFrame = new InternalFrame(child, this.app);
            this.app.frames.push(internalFrame);
        }

        // Add $on method to app for backward compatibility
        if (!this.app.$on) {
            this.app.$on = (event: string, callback: Function) => {
                if (event === "close") {
                    this.app.frames.forEach((frame) => (frame as InternalFrame).$on("close", callback));
                }
            };
        }
    }

    // Method to trigger close event on all frames
    triggerCloseEvent() {
        this.app.frames.forEach((frame) => (frame as InternalFrame).$emit("close"));
    }
}
