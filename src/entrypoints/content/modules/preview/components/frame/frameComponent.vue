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
                v-if="frames[0]"
                ref="bodyFrameRef"
                :frame="frames[0]"
                :index="0"
            />
            <RefresherFrame
                v-if="frames[1]"
                ref="commentFrameRef"
                :frame="frames[1]"
                :index="1"
            />

            <div id="scroll">
                <img
                    :src="upvoteUrl"
                    @click="() => clickScroll('up')"
                />
                <img
                    :src="downvoteUrl"
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
import {onBeforeUnmount, onMounted, provide, ref} from "vue";

import RefresherFrame from "./frame.vue";
import upvoteIcon from "@/assets/icons/upvote.webp?no-inline";
import downvoteIcon from "@/assets/icons/downvote.webp?no-inline";
import RefresherScroll from "./scroll.vue";
import type {FrameStackOption, PreviewFrame} from "../../frame";
import {useFrameFade} from "../../composables/useFrameFade";

const upvoteUrl = browser.runtime.getURL(upvoteIcon as never);
const downvoteUrl = browser.runtime.getURL(downvoteIcon as never);

interface Props {
    frames: PreviewFrame[];
    option?: FrameStackOption;
}

const props = withDefaults(defineProps<Props>(), {
    option: () => ({})
});

const emit = defineEmits<{
    close: [];
}>();

const scrollModeTop = ref(false);
const scrollModeBottom = ref(false);
const inputFocus = ref(false);
const groupElement = ref<HTMLElement>();
const bodyFrameRef = ref<{ incrementCommentKey?: () => void } | null>(null);
const commentFrameRef = ref<{ incrementCommentKey?: () => void } | null>(null);

provide("refresherInputFocus", inputFocus);

const background = ref(props.option?.background ?? false);
const blur = ref(props.option?.blur ?? false);
const onScroll = props.option?.onScroll;

// 페이드 전환 컴포저블 (fade/closed/fadeIn/fadeOut, body overflow, timer 관리)
const {fade, closed, fadeIn, fadeOut} = useFrameFade(() => {
    props.frames.forEach((frame) => frame.emitClose());
});

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
        onScroll(ev, groupElement.value as HTMLElement);
    }
};

const setScrollMode = (mode: "top" | "bottom" | "none") => {
    scrollModeTop.value = mode === "top";
    scrollModeBottom.value = mode === "bottom";
};

const clearScrollMode = () => setScrollMode("none");

const outerClick = () => {
    emit("close");
    fadeOut();
};

const close = () => outerClick();

const onClose = (handler: () => void) => {
    props.frames.forEach((frame) => frame.onClose(handler));
};

onMounted(() => {
    document.body.style.overflow = "hidden";
    document.addEventListener("keyup", onKeyUp);
});

onBeforeUnmount(() => {
    document.removeEventListener("keyup", onKeyUp);
});

defineExpose({
    frames: props.frames,
    fade,
    closed,
    inputFocus,
    groupElement,
    bodyFrameRef,
    commentFrameRef,
    body: () => props.frames[0],
    comment: () => props.frames[1],
    setScrollMode,
    clearScrollMode,
    outerClick,
    close,
    fadeIn,
    fadeOut,
    onClose
});
</script>

<style lang="scss">
@use "@/assets/styles/variables" as *;

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
    z-index: $z-tooltip;

    &.background {
        background-color: var(--refresher-bg-overlay);
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
        transition: 0.6s opacity $ease-out-expo;

        .refresher-frame {
            transform: translateY(0px);
            transition: 0.5s transform $ease-out-expo;
        }
    }

    &.fadeOut {
        opacity: 0;
        pointer-events: none;
        transition: 0.25s opacity $ease-out-expo;

        .refresher-frame {
            transform: translateY(10px);
            transition: 0.25s transform $ease-out-expo;
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
    z-index: $z-tooltip;
}
</style>