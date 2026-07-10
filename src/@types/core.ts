export {};

declare global {
    type RefresherUnknownHandler = (...args: unknown[]) => void;

    interface RefresherFilteringLists {
        func: (element: HTMLElement) => void;
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
        on: (event: string, callback: (...args: any[]) => void, options?: RefresherEventBusOptions) => string;
        remove: (event: string, uuid: string, skip?: boolean) => void;
    }

    interface RefresherEventBusObject {
        func: (...args: any[]) => void;
        uuid: string;
        once?: boolean;
    }
}