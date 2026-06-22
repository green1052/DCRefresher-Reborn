<template>
    <div
        v-show="!closed"
        :class="{
            background: background,
            blur: blur,
            fadeIn: fade,
            fadeOut: !fade,
            stack: fade
        }"
        class="refresher-frame-outer"
    >
        <div
            ref="groupElement"
            class="refresher-group"
            @click="clickHandle"
            @wheel="wheelHandle"
        >
            <RefresherFrame
                v-if="bodyFrame"
                ref="bodyFrameRef"
                :frame="bodyFrame"
                :index="0"
            />
            <RefresherFrame
                v-if="commentFrame"
                ref="commentFrameRef"
                :frame="commentFrame"
                :index="1"
            />

            <div id="scroll">
                <img
                    :src="browser.runtime.getURL('/assets/upvote.webp')"
                    @click="() => clickScroll('up')"
                />
                <img
                    :src="browser.runtime.getURL('/assets/downvote.webp')"
                    @click="() => clickScroll('down')"
                />
            </div>
        </div>
        <transition name="refresher-prev-post">
            <RefresherScroll
                v-if="scrollModeTop"
                side="top"
            />
        </transition>
        <transition name="refresher-next-post">
            <RefresherScroll
                v-if="scrollModeBottom"
                side="bottom"
            />
        </transition>
    </div>
</template>

<script lang="ts" setup>
import {getCurrentInstance, onBeforeUnmount, onMounted, ref, watch} from "vue";

import RefresherFrame from "../components/frame.vue";
import RefresherScroll from "../components/scroll.vue";
import {FrameOption, FrameScrollApi, FrameStackOption} from "./frame";
import {createFrameRuntime} from "./frameRuntime";

interface Props {
    option?: FrameStackOption;
    children?: FrameOption[];
}

const props = withDefaults(defineProps<Props>(), {
    option: () => ({}),
    children: () => []
});
const instance = getCurrentInstance();

const emit = defineEmits<{
    close: [];
}>();

type FrameEventHandler = (...args: unknown[]) => void;
type FrameComponentApi = Pick<
    RefresherFrameAppVue,
    "body" | "comment" | "setScrollMode" | "clearScrollMode" | "outerClick" | "close" | "fadeIn" | "fadeOut" | "$on"
> & {
    frames: RefresherFrame[];
    fade: boolean;
    scrollModeTop: boolean;
    scrollModeBottom: boolean;
    closed: boolean;
    inputFocus: boolean;
    groupElement?: HTMLElement;
    bodyFrameRef?: { incrementCommentKey?: () => void; commentKey?: { value: number } } | null;
    commentFrameRef?: { incrementCommentKey?: () => void; commentKey?: { value: number } } | null;
};

// Reactive data
const frames = ref<RefresherFrame[]>(props.children.map((child) => createFrameRuntime(child)));
const fade = ref(false);
const scrollModeTop = ref(false);
const scrollModeBottom = ref(false);
const closed = ref(false);
const inputFocus = ref(false);

interface ClosableFrame {
    $emit: (event: string, ...args: unknown[]) => void;
}

const isClosableFrame = (frame: RefresherFrame): frame is RefresherFrame & ClosableFrame => {
    return typeof (frame as Partial<ClosableFrame>).$emit === "function";
};

const groupElement = ref<HTMLElement>();
const bodyFrameRef = ref<{ incrementCommentKey?: () => void; commentKey?: { value: number } } | null>(null);
const commentFrameRef = ref<{ incrementCommentKey?: () => void; commentKey?: { value: number } } | null>(null);
let fadeOutTimer: number | null = null;

// Spread option properties
const background = ref(props.option && props.option.background ? props.option.background : false);
const blur = ref(props.option && props.option.blur ? props.option.blur : false);
const onScroll = props.option && props.option.onScroll ? props.option.onScroll : undefined;

// Watch for closed state changes
watch(closed, (val: boolean) => {
    document.body.style.overflow = val ? "" : "hidden";
});

// Lifecycle hook
const onKeyUp = (ev: KeyboardEvent) => {
    if (ev.code === "Escape" && !closed.value) {
        outerClick();
    }
};

const clickScroll = (type: "up" | "down") => {
    if (!groupElement.value) return;
    const y = type === "up" ? 0 : groupElement.value.scrollHeight;
    groupElement.value.scroll(0, y);
};

const clickHandle = (ev: MouseEvent) => {
    if (ev.target !== groupElement.value) return;

    const selection = window.getSelection();
    if (selection && selection.toString().length !== 0) return;

    outerClick();
};

const wheelHandle = (ev: WheelEvent) => {
    if (typeof onScroll === "function") {
        onScroll(
            ev,
            instance?.exposed as FrameScrollApi,
            groupElement.value as HTMLElement
        );
    }
};

onMounted(() => {
    document.body.style.overflow = "hidden";
    document.addEventListener("keyup", onKeyUp);
});

onBeforeUnmount(() => {
    document.removeEventListener("keyup", onKeyUp);
    document.body.style.overflow = "";

    if (fadeOutTimer !== null) {
        window.clearTimeout(fadeOutTimer);
        fadeOutTimer = null;
    }

    appCloseSubscribers.clear();
});

// Methods
const body = () => {
    return frames.value[0];
};

const comment = () => {
    return frames.value[1];
};

const bodyFrame = ref<RefresherFrame | undefined>(body());
const commentFrame = ref<RefresherFrame | undefined>(comment());

const setScrollMode = (mode: "top" | "bottom" | "none") => {
    scrollModeTop.value = mode === "top";
    scrollModeBottom.value = mode === "bottom";
};

const clearScrollMode = () => {
    setScrollMode("none");
};

const outerClick = () => {
    // Broadcast close to each frame runtime.
    frames.value.forEach((frame) => {
        if (frame && isClosableFrame(frame)) {
            frame.$emit("close");
        }
    });

    emit("close");
    fadeOut();
};

const close = () => {
    outerClick();
};

const fadeIn = () => {
    fade.value = true;
    closed.value = false;
};

const fadeOut = () => {
    fade.value = false;

    if (fadeOutTimer !== null) {
        window.clearTimeout(fadeOutTimer);
    }

    fadeOutTimer = window.setTimeout(() => {
        closed.value = true;
        fadeOutTimer = null;
    }, 251);
};

const appCloseSubscribers = new Set<FrameEventHandler>();
const appOn = (event: string, callback: FrameEventHandler) => {
    if (event !== "close") return;
    appCloseSubscribers.add(callback);
};

const emitAppClose = (...args: unknown[]) => {
    appCloseSubscribers.forEach((handler) => handler(...args));
};

// Expose methods for external access
defineExpose({
    frames,
    fade,
    scrollModeTop,
    scrollModeBottom,
    closed,
    inputFocus,
    groupElement,
    bodyFrameRef,
    commentFrameRef,
    body,
    comment,
    setScrollMode,
    clearScrollMode,
    outerClick,
    close,
    fadeIn,
    fadeOut,
    $on: appOn
});

onMounted(() => {
    const app = instance?.exposed as FrameComponentApi | undefined;
    if (!app) return;

    frames.value.forEach((frame) => {
        frame.app = app as unknown as RefresherFrameAppVue;
    });

    bodyFrame.value = body();
    commentFrame.value = comment();
});

watch(closed, (value) => {
    if (value) {
        emitAppClose();
    }
});
</script>

<style lang="scss">
$shadow-0dp: none;
$shadow-1dp: 0px 0px 16px rgba(0, 0, 0, 0.08);
$shadow-2dp: 0px 0px 16px rgba(0, 0, 0, 0.12);
$shadow-3dp: 0px 0px 16px rgba(0, 0, 0, 0.24);

.refresher-frame-outer {
    display: flex;
    left: 0;
    margin: 0;
    min-height: 100%;
    opacity: 0;
    overflow: hidden;
    position: fixed;
    top: 0;
    width: 100%;
    z-index: 2000;

    &.background {
        background-color: rgba(221, 221, 221, 0.6);
    }

    &.blur {
        backdrop-filter: blur(5px) saturate(150%);
    }

    &.center {
        align-items: center;
        justify-content: center;
    }

    &.fadeIn {
        opacity: 1;
        transition: 0.6s opacity cubic-bezier(0.19, 1, 0.22, 1);

        .refresher-frame {
            transform: translateY(0px);
            transition: 0.5s transform cubic-bezier(0.19, 1, 0.22, 1);
        }
    }

    &.fadeOut {
        opacity: 0;
        pointer-events: none;
        transition: 0.25s opacity cubic-bezier(0.19, 1, 0.22, 1);

        .refresher-frame {
            transform: translateY(10px);
            transition: 0.25s transform cubic-bezier(0.19, 1, 0.22, 1);
        }
    }

    &.stack {
        display: block;
        min-height: 100%;
    }
}

.refresher-group {
    display: block;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    position: absolute;
    width: 100%;
}

#scroll {
    bottom: 5px;
    display: grid;
    position: fixed;
    right: 0;
    user-select: none;
    width: 100px;
    z-index: 2000;
}

.refresher-scroll {
    background: linear-gradient(to top, rgba(12, 23, 53, 0.7), rgba(32, 42, 72, 0.3), rgba(0, 0, 0, 0));
    bottom: 0;
    color: white;
    display: flex;
    height: 40%;
    justify-content: center;
    left: 0;
    pointer-events: none;
    position: fixed;
    width: 100%;

    .center {
        margin: auto;
        position: relative;
        top: 20%;

        p {
            font-size: 24px;
            font-weight: bold;
            letter-spacing: -1.66px;
        }
    }

    &.top {
        background: linear-gradient(to bottom, rgba(12, 23, 53, 0.7), rgba(32, 42, 72, 0.3), rgba(0, 0, 0, 0));
        bottom: unset;
        top: 0;

        .center {
            bottom: 20%;
            top: unset;
        }
    }
}
</style>
