import {reactive} from "vue";

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

interface ReactiveFrameState {
    title: string;
    subtitle: string;
    contents: string | undefined;
    upvotes: string | undefined;
    fixedUpvotes: string | undefined;
    downvotes: string | undefined;
    error: { title: string; detail: string } | undefined;
    collapse: boolean | undefined;
    data: FrameData;
}

export class PreviewFrame {
    readonly options: FrameOptions;
    readonly state: ReactiveFrameState;
    functions: FrameFunctions;

    private closeHandlers = new Set<CloseHandler>();

    constructor(options: FrameOptions = {}) {
        this.options = options;
        this.state = reactive({
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
        this.functions = {
            vote: noopAsyncResult,
            share: noopAsyncResult,
            load: noopAsync,
            retry: noop,
            openOriginal: noopAsyncResult,
            writeComment: noopAsyncResult,
            deleteComment: noopAsyncResult
        };
    }

    get title(): string {
        return this.state.title;
    }

    set title(v: string) {
        this.state.title = v;
    }

    get subtitle(): string {
        return this.state.subtitle;
    }

    set subtitle(v: string) {
        this.state.subtitle = v;
    }

    get contents(): string | undefined {
        return this.state.contents;
    }

    set contents(v: string | undefined) {
        this.state.contents = v;
    }

    get upvotes(): string | undefined {
        return this.state.upvotes;
    }

    set upvotes(v: string | undefined) {
        this.state.upvotes = v;
    }

    get fixedUpvotes(): string | undefined {
        return this.state.fixedUpvotes;
    }

    set fixedUpvotes(v: string | undefined) {
        this.state.fixedUpvotes = v;
    }

    get downvotes(): string | undefined {
        return this.state.downvotes;
    }

    set downvotes(v: string | undefined) {
        this.state.downvotes = v;
    }

    get error(): { title: string; detail: string } | undefined {
        return this.state.error;
    }

    set error(v: { title: string; detail: string } | undefined) {
        this.state.error = v;
    }

    get collapse(): boolean | undefined {
        return this.state.collapse;
    }

    set collapse(v: boolean | undefined) {
        this.state.collapse = v;
    }

    get data(): FrameData {
        return this.state.data;
    }

    reset(): void {
        this.state.title = "";
        this.state.subtitle = "";
        this.state.contents = undefined;
        this.state.upvotes = undefined;
        this.state.fixedUpvotes = undefined;
        this.state.downvotes = undefined;
        this.state.error = undefined;
        this.state.collapse = undefined;
        this.state.data.load = false;
        this.state.data.buttons = false;
        this.state.data.disabledDownvote = false;
        this.state.data.user = undefined;
        this.state.data.date = undefined;
        this.state.data.expire = undefined;
        this.state.data.views = undefined;
        this.state.data.useWriteComment = false;
        this.state.data.comments = undefined;
        this.state.data.postUserId = undefined;
        this.state.data.type = "";
        this.state.data.useImageBlock = false;
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