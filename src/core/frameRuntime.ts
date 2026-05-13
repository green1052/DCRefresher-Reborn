import type {FrameOption} from "./frame";

type FrameEventHandler = (...args: unknown[]) => void;
type FrameEventMap = Map<string, FrameEventHandler[]>;

const createFrameData = (): RefresherFrame["data"] => ({
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

const createFrameFunctions = (): RefresherFrame["functions"] => ({
    vote: async () => false,
    share: () => false,
    load: async () => {
    },
    retry: () => {
    },
    openOriginal: () => false,
    writeComment: async () => false,
    deleteComment: async () => false
});

export const createFrameRuntime = (options: FrameOption): RefresherFrame => {
    const listeners: FrameEventMap = new Map();

    return {
        options,
        title: "",
        subtitle: "",
        app: undefined as unknown as RefresherFrameAppVue,
        contents: undefined,
        upvotes: undefined,
        fixedUpvotes: undefined,
        downvotes: undefined,
        error: undefined,
        collapse: undefined,
        data: createFrameData(),
        functions: createFrameFunctions(),
        resetRuntime() {
            this.title = "";
            this.subtitle = "";
            this.contents = undefined;
            this.upvotes = undefined;
            this.fixedUpvotes = undefined;
            this.downvotes = undefined;
            this.error = undefined;
            this.collapse = undefined;
            this.data = createFrameData();
            this.functions = createFrameFunctions();
        },
        $on(event: string, callback: FrameEventHandler) {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event)?.push(callback);
        },
        $off(event: string, callback?: FrameEventHandler) {
            if (!callback) {
                listeners.delete(event);
                return;
            }

            const callbacks = listeners.get(event);
            if (!callbacks) return;

            const index = callbacks.indexOf(callback);
            if (index >= 0) callbacks.splice(index, 1);
        },
        $emit(event: string, ...args: unknown[]) {
            const callbacks = listeners.get(event);
            if (!callbacks?.length) return;
            callbacks.forEach((cb) => cb(...args));
        }
    } as RefresherFrame & {
        resetRuntime: () => void;
        $on: (event: string, callback: FrameEventHandler) => void;
        $off: (event: string, callback?: FrameEventHandler) => void;
        $emit: (event: string, ...args: unknown[]) => void;
    };
};
