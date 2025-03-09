import frame from "./frameComponent.vue";
import { User } from "../utils/user";
import Vue from "vue";

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
            render: (h) =>
                h(frame, {
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
