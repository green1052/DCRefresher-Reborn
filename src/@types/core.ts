import type {User} from "../utils/user";

export {};

declare global {
    type RefresherUnknownHandler = (...args: unknown[]) => void;

    interface RefresherFilteringLists {
        func: <T = HTMLElement>(element: T) => void;
        scope: string;
        events: Record<string, RefresherUnknownHandler[]>;
        options?: RefresherFilteringOptions;
        expire?: () => void;
    }

    interface RefresherFilteringOptions {
        neverExpire?: boolean;
        skipIfNotExists?: boolean;
    }

    interface RefresherEventBusOptions {
        once: boolean;
    }

    interface RefresherEventBus {
        emit: (event: string, ...params: unknown[]) => void;
        emitNextTick: (event: string, ...params: unknown[]) => void;
        on: (event: string, callback: RefresherUnknownHandler, options?: RefresherEventBusOptions) => string;
        remove: (event: string, uuid: string, skip?: boolean) => void;
    }

    interface RefresherEventBusObject {
        func: RefresherUnknownHandler;
        uuid: string;
        once?: boolean;
    }

    interface RefresherFrame {
        options: {
            relative?: boolean;
            center?: boolean;
            preview?: boolean;
            blur?: boolean;
        };
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
            postUserId?: string;
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
                commentNo: string | null,
                replyNo: string | null,
                user: { name: string; pw?: string },
                bigDccon: boolean
            ): Promise<boolean>;
            deleteComment(commentId: string, password: string, admin: boolean): Promise<boolean>;
        };
    }
}
