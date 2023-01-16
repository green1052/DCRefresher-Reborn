export {};

declare global {
    interface RefresherFilteringLists {
        func: (element: Element) => void;
        scope: string;
        events: { [index: string]: ((...args: any[]) => void)[] };
        options?: RefresherFilteringOptions;
        expire?: () => void;
    }

    interface RefresherFilteringOptions {
        neverExpire?: boolean;
        skipIfNotExists?: boolean;
    }

    interface RefresherFilter {
        readonly __run: (
            a: RefresherFilteringLists,
            e: NodeListOf<Element>
        ) => Promise<void>;
        /**
         * 필터로 등록된 함수들을 전부 실행합니다.
         *
         * @param non_blocking 비차단 방식으로 렌더링 합니다. (페이지 로드 후)
         */
        run: () => Promise<void>;
        /**
         * 파라매터로 주어진 UUID를 가진 필터를 실행합니다.
         *
         * @param id UUID를 지정합니다.
         */
        runSpecific: (id: string) => Promise<void>;
        /**
         * 필터로 사용할 함수를 등록합니다.
         */
        add: (
            scope: string,
            cb: (elem: Element | HTMLElement) => void,
            options?: RefresherFilteringOptions
        ) => string;
        /**
         * UUID를 직접 선언하여 함수를 필터로 등록합니다.
         */
        addGlobal: (id: string, scope: string, cb: () => void) => void;
        /**
         * 해당 UUID를 가진 필터를 제거합니다.
         */
        remove: (uuid: string, skip?: boolean) => void;
        /**
         * 해당 UUID의 이벤트에 콜백 함수를 등록합니다.
         */
        on: (uuid: string, event: string, cb: (...args: any[]) => void) => void;
        /**
         * 해당 UUID에 이벤트를 발생시킵니다.
         */
        events: (uuid: string, event: string, ...args: any[]) => void;
    }

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

    type RefresherBlock = typeof import("../core/block")

    type RefresherMemoType = "UID" | "NICK" | "IP";

    interface RefresherMemoValue {
        text: string;
        color: string;
        gallery?: string;
    }

    type RefresherMemo = typeof import("../core/memo")
}