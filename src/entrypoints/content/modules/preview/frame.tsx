import {type Root, createRoot} from "react-dom/client";
import {flushSync} from "react-dom";

import FrameComponent from "./components/frame/frameComponent";
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

const stateKeys = new Set(Object.keys(createInitialState()));

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

    private version = 0;
    private readonly listeners = new Set<() => void>();
    private readonly closeHandlers = new Set<CloseHandler>();
    // frame.data.load = true 같은 중첩 쓰기도 구독자에게 알린다
    private dataProxy: FrameData;

    constructor(options: FrameOptions = {}) {
        this.options = options;
        this.state = createInitialState();
        this.functions = {
            vote: noopAsyncResult,
            share: noopAsyncResult,
            load: noopAsync,
            retry: noop,
            openOriginal: noopAsyncResult,
            writeComment: noopAsyncResult,
            deleteComment: noopAsyncResult
        };
        this.dataProxy = this.wrapData(this.state.data);

        const self = this;
        return new Proxy(this, {
            get(target, prop, receiver) {
                if (prop === "data") return self.dataProxy;
                if (typeof prop === "string" && stateKeys.has(prop)) {
                    return Reflect.get(target.state, prop);
                }
                return Reflect.get(target, prop, receiver);
            },
            set(target, prop, value, receiver) {
                if (prop === "data") {
                    target.state.data = value as FrameData;
                    self.dataProxy = self.wrapData(target.state.data);
                    self.notify();
                    return true;
                }
                if (typeof prop === "string" && stateKeys.has(prop)) {
                    const result = Reflect.set(target.state, prop, value);
                    self.notify();
                    return result;
                }
                return Reflect.set(target, prop, value, receiver);
            }
        }) as PreviewFrame;
    }

    private wrapData(data: FrameData): FrameData {
        const self = this;
        return new Proxy(data, {
            set(target, prop, value, receiver) {
                const result = Reflect.set(target, prop, value, receiver);
                self.notify();
                return result;
            }
        });
    }

    // useSyncExternalStore용 구독 API
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = (): number => this.version;

    private notify(): void {
        this.version++;
        for (const listener of this.listeners) {
            listener();
        }
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
        this.notify();
    }

    onClose(handler: CloseHandler): void {
        this.closeHandlers.add(handler);
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
    close: () => void;
    fadeIn: () => void;
    closed: boolean;
    inputFocus: boolean;
    groupElement: HTMLElement | undefined;
    commentFrameRef: { incrementCommentKey?: () => void } | null;
    onClose: (handler: () => void) => void;
}

export default class Frame {
    readonly frames: PreviewFrame[];
    readonly app: FrameScrollApi;
    private readonly rootElement: HTMLElement;
    private readonly root: Root;

    constructor(children: FrameOptions[], option: FrameStackOption) {
        if (document.readyState === "loading") {
            throw new Error("Frame is not available before DOMContentLoaded event. (DOM isn't accessible)");
        }

        this.frames = children.map((child) => new PreviewFrame(child));

        this.rootElement = document.createElement("refresher-frame-outer");
        document.body.appendChild(this.rootElement);

        const apiRef: { current: FrameScrollApi | null } = {current: null};

        this.root = createRoot(this.rootElement);
        flushSync(() => {
            this.root.render(
                <FrameComponent
                    apiRef={apiRef}
                    frames={this.frames}
                    option={option}
                />
            );
        });

        this.app = apiRef.current as FrameScrollApi;
    }

    destroy(): void {
        this.root.unmount();
        this.rootElement.remove();
    }
}
