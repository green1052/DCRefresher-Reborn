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

// 초기 data 팩토리 (reset 재사용)
const createInitialData = (): FrameData => ({
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
});

export class PreviewFrame {
    readonly options: FrameOptions;
    functions: FrameFunctions;

    title = "";
    subtitle = "";
    contents: string | undefined;
    upvotes: string | undefined;
    fixedUpvotes: string | undefined;
    downvotes: string | undefined;
    error: { title: string; detail: string } | undefined;
    collapse: boolean | undefined;
    data: FrameData = createInitialData();

    private version = 0;
    private readonly listeners = new Set<() => void>();
    private readonly closeHandlers = new Set<CloseHandler>();

    constructor(options: FrameOptions = {}) {
        this.options = options;
        this.functions = {
            vote: async () => false,
            share: async () => false,
            load: async () => {
            },
            retry: () => {
            },
            openOriginal: async () => false,
            writeComment: async () => false,
            deleteComment: async () => false
        };
    }

    // 상태 일괄 갱신 - 한 번의 알림으로 React를 재렌더링한다.
    patch(part: Partial<Omit<PreviewFrame, "options" | "functions" | "data">>): void {
        Object.assign(this, part);
        this.notify();
    }

    patchData(part: Partial<FrameData>): void {
        Object.assign(this.data, part);
        this.notify();
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

    // 초기 상태로 일괄 리셋
    reset(): void {
        this.title = "";
        this.subtitle = "";
        this.contents = undefined;
        this.upvotes = undefined;
        this.fixedUpvotes = undefined;
        this.downvotes = undefined;
        this.error = undefined;
        this.collapse = undefined;
        Object.assign(this.data, createInitialData());
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
