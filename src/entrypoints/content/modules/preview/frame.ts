import {type App, createApp, reactive} from "vue";

import frameRoot from "./components/frame/frameComponent.vue";
import type {User} from "@/utils/user";

export interface FrameOptions {
    relative?: boolean;
    center?: boolean;
    preview?: boolean;
    blur?: boolean;
}

export interface FrameData {
    load: boolean;
    buttons: boolean;
    disabledDownvote: boolean;
    user: User | undefined;
    date: Date | undefined;
    expire: Date | undefined;
    views: string | undefined;
    useWriteComment: boolean;
    comments: DcinsideComments | undefined;
    postUserId: string | undefined;
    type: string;
    useImageBlock: boolean;
}

export interface FrameFunctions {
    vote: (type: number) => Promise<boolean>;
    share: () => Promise<boolean>;
    load: (useCache?: boolean) => Promise<void>;
    retry: (useCache?: boolean) => void;
    openOriginal: () => Promise<boolean>;
    writeComment: (
        type: "text" | "dccon",
        memo: string | DcinsideDccon[],
        commentNo: string | null,
        replyNo: string | null,
        user: { name: string; pw?: string },
        bigDccon: boolean
    ) => Promise<boolean>;
    deleteComment: (commentId: string, password: string, admin: boolean) => Promise<boolean>;
}

type CloseHandler = () => void;

const noopAsync = async () => {
};
const noopAsyncResult = async () => false;
const noop = () => {
};

// 초기 상태 팩토리 (reset 재사용)
const createInitialState = (): {
    title: string;
    subtitle: string;
    contents: string | undefined;
    upvotes: string | undefined;
    fixedUpvotes: string | undefined;
    downvotes: string | undefined;
    error: { title: string; detail: string } | undefined;
    collapse: boolean | undefined;
    data: FrameData;
} => ({
    title: "",
    subtitle: "",
    contents: undefined,
    upvotes: undefined,
    fixedUpvotes: undefined,
    downvotes: undefined,
    error: undefined,
    collapse: undefined,
    data: {
        load: false,
        buttons: false,
        disabledDownvote: false,
        user: undefined,
        date: undefined,
        expire: undefined,
        views: undefined,
        useWriteComment: false,
        comments: undefined,
        postUserId: undefined,
        type: "",
        useImageBlock: false
    }
});

export class PreviewFrame {
    readonly options: FrameOptions;
    readonly state: ReturnType<typeof createInitialState>;
    functions: FrameFunctions;

    declare title: string;
    declare subtitle: string;
    declare contents: string | undefined;
    declare upvotes: string | undefined;
    declare fixedUpvotes: string | undefined;
    declare downvotes: string | undefined;
    declare error: { title: string; detail: string } | undefined;
    declare collapse: boolean | undefined;
    declare data: FrameData;

    private closeHandlers = new Set<CloseHandler>();

    constructor(options: FrameOptions = {}) {
        this.options = options;
        this.state = reactive(createInitialState());
        this.functions = {
            vote: noopAsyncResult,
            share: noopAsyncResult,
            load: noopAsync,
            retry: noop,
            openOriginal: noopAsyncResult,
            writeComment: noopAsyncResult,
            deleteComment: noopAsyncResult
        };

        const stateKeys = new Set(Object.keys(this.state));
        return new Proxy(this, {
            get(target, prop, receiver) {
                if (typeof prop === "string" && stateKeys.has(prop)) {
                    return Reflect.get(target.state, prop, receiver);
                }
                return Reflect.get(target, prop, receiver);
            },
            set(target, prop, value, receiver) {
                if (typeof prop === "string" && stateKeys.has(prop)) {
                    return Reflect.set(target.state, prop, value, receiver);
                }
                return Reflect.set(target, prop, value, receiver);
            }
        });
    }

    // 초기 상태로 일괄 리셋 (팩토리 재사용으로 자동화)
    reset(): void {
        const initial = createInitialState();
        Object.assign(this.state, {
            title: initial.title,
            subtitle: initial.subtitle,
            contents: initial.contents,
            upvotes: initial.upvotes,
            fixedUpvotes: initial.fixedUpvotes,
            downvotes: initial.downvotes,
            error: initial.error,
            collapse: initial.collapse
        });
        Object.assign(this.state.data, initial.data);
    }

    onClose(handler: CloseHandler): void {
        this.closeHandlers.add(handler);
    }

    offClose(handler: CloseHandler): void {
        this.closeHandlers.delete(handler);
    }

    emitClose(): void {
        this.closeHandlers.forEach((handler) => handler());
    }
}

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