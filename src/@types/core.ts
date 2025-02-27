import type {User} from "../utils/user";

export {};

declare global {
    interface RefresherFilteringLists {
        func: <T = HTMLElement>(element: T) => void;
        scope: string;
        events: Record<string, Array<(...args: any[]) => void>>;
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
        on: (
            event: string,
            callback: (...any: any[]) => void,
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
        error?: { title: string; detail: string } | undefined;
        collapse?: boolean;
        data: {
            load: boolean;
            buttons: boolean;
            disabledDownvote: boolean;
            user: User | undefined;
            date: Date | undefined;
            expire: Date | undefined;
            views: string | undefined;
            useWriteComment: boolean;
            comments: DcinsideComments | undefined;
            type: string;
            useImageBlock: boolean;
        };
        functions: {
            vote(type: number): Promise<boolean>;
            share(): boolean;
            load(useCache?: boolean): Promise<void>;
            retry(useCache?: boolean): void;
            openOriginal(): boolean;
            writeComment(
                type: "text" | "dccon",
                memo: string | DcinsideDccon[],
                reply: string | null,
                user: { name: string; pw?: string }
            ): Promise<boolean>;
            deleteComment(
                commentId: string,
                password: string,
                admin: boolean
            ): Promise<boolean>;
        };
    }
}
