export {};

declare global {
    interface RefresherFilteringLists {
        func: <T = HTMLElement>(element: T) => void;
        scope: string;
        events: { [index: string]: ((...args: any[]) => void)[] };
        options?: RefresherFilteringOptions;
        expire?: () => void;
    }

    interface RefresherFilteringOptions {
        neverExpire?: boolean;
        skipIfNotExists?: boolean;
    }

    type RefresherFilter = typeof import("../core/filtering").filter;

    interface RefresherEventBusOptions {
        once: boolean;
    }

    interface RefresherEventBus {
        emit: (event: string, ...params: any[]) => void;
        emitNextTick: (event: string, ...params: any[]) => void;
        emitForResult: (event: string, ...params: any[]) => Promise<void>;
        on: (
            event: string,
            cb: (...any: any[]) => void,
            options?: RefresherEventBusOptions
        ) => string;
        remove: (event: string, uuid: string, skip?: boolean) => void;
    }

    interface RefresherEventBusObject {
        func: (...params: any[]) => void;
        uuid: string;
        once?: boolean;
    }

    interface RefresherFrame {
        title: string;
        subtitle: string;
        app: RefresherFrameAppVue;
        contents: string | undefined;
        upvotes: string | undefined;
        fixedUpvotes: string | undefined;
        downvotes: string | undefined;
        error?: { title: string; detail: string; } | undefined;
        collapse?: boolean;
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
            load(useCache = true): void;
            retry(useCache = false): void;
            openOriginal(): boolean;
            writeComment(type: "text" | "dccon", memo: string | DcinsideDccon, reply: string | null, user: { name: string; pw?: string }): Promise<boolean>
            deleteComment(commentId: string, password: string, admin: boolean): Promise<boolean>;
        };
    }

    type RefresherBlockType = "NICK" | "ID" | "IP" | "TITLE" | "TEXT" | "COMMENT" | "DCCON";

    type RefresherBlockDetectMode = "SAME" | "CONTAIN" | "NOT_SAME" | "NOT_CONTAIN"

    interface RefresherBlockValue {
        content: string;
        isRegex: boolean;
        gallery?: string;
        extra?: string;
        mode?: RefresherBlockDetectMode;
    }

    type RefresherBlock = typeof import("../core/block");

    type RefresherMemoType = "UID" | "NICK" | "IP";

    interface RefresherMemoValue {
        text: string;
        color: string;
        gallery?: string;
    }

    type RefresherMemo = typeof import("../core/memo");
}