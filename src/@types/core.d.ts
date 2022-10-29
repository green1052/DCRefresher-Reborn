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
        contents: string;
        comments: dcinsideComments | Record<string, unknown>;
        upvotes: string | null;
        fixedUpvotes: string | null;
        downvotes: string | null;
        buttonError: unknown;
        error?: unknown;
        collapse?: boolean;

        data: { [index: string]: unknown };
        functions: {
            [index: string]: (...args: any[]) => Promise<boolean> | boolean
        };
    }

    interface RefresherBlockValue {
        content: string;
        isRegex: boolean;
        gallery?: string;
        extra?: string;
    }

    interface RefresherBlock {
        /**
         * 타입의 이름을 저장한 객체입니다.
         */
        TYPE_NAMES: { [index: string]: string };

        /**
         * 차단 목록에 추가합니다.
         *
         * @param type 차단 종류
         * @param content 차단 내용
         * @param isRegex 정규식인지에 대한 여부
         * @param gallery 특정 갤러리에만 해당하면 갤러리의 ID 값
         * @param extra 차단 목록에서의 식별을 위한 추가 값
         */
        add (
            type: string,
            content: string,
            isRegex: boolean,
            gallery?: string,
            extra?: string
        ): void;

        /**
         * 주어진 type의 차단의 모드를 변경합니다.
         *
         * @param type 차단 종류
         * @param mode 차단 모드
         */
        updateMode (type: string, mode: string): void;

        /**
         * 해당 내용이 차단될 내용인지를 반환합니다.
         *
         * @param type 차단 종류
         * @param content 확인할 내용
         * @param gallery 현재 갤러리
         */
        check (type: string, content: string, gallery: string): boolean;

        /**
         * 데이터를 저장합니다. (내부)
         *
         * @param store
         * @param mode
         */
        setStore (
            store: { [index: string]: RefresherBlockValue[] },
            mode: { [index: string]: string }
        ): void;

        /**
         * obj에 있는 모든 키 값들이 차단 목록에 있는지 검사합니다.
         *
         * @param obj 검사할 객체
         * @param gallery 갤러리 이름 (선택)
         */
        checkAll (obj: { [index: string]: string }, gallery?: string): boolean;
    }
}