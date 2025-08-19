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
        <RefresherGroup
            ref="groupRef"
            :frames="frames"
            :on-scroll="onScroll"
            :outer-click="outerClick"
        />
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
import { onMounted, ref, watch } from "vue";

import RefresherGroup from "../components/group.vue";
import RefresherScroll from "../components/scroll.vue";
import { FrameStackOption } from "./frame";

interface Props {
    option?: FrameStackOption;
}

const props = withDefaults(defineProps<Props>(), {
    option: () => ({})
});

const emit = defineEmits<{
    close: [];
}>();

// Reactive data
const frames = ref<RefresherFrame[]>([]);
const fade = ref(false);
const stampMode = ref(false);
const scrollModeTop = ref(false);
const scrollModeBottom = ref(false);
const closed = ref(false);
const inputFocus = ref(false);
const groupRef = ref<any>(null);

// Spread option properties
const background = ref(props.option && props.option.background ? props.option.background : false);
const blur = ref(props.option && props.option.blur ? props.option.blur : false);
const onScroll = props.option && props.option.onScroll ? props.option.onScroll : undefined;

// Watch for closed state changes
watch(closed, (val: boolean) => {
    document.body.style.overflow = val ? "auto" : "hidden";
});

// Lifecycle hook
onMounted(() => {
    document.body.style.overflow = "hidden";

    document.addEventListener("keyup", (ev) => {
        if (ev.code === "Escape" && !closed.value) {
            outerClick();
        }
    });
});

// Methods
const changeStamp = () => {
    stampMode.value = !stampMode.value;
};

const first = () => {
    return frames.value[0];
};

const second = () => {
    return frames.value[1];
};

const clearScrollMode = () => {
    scrollModeTop.value = false;
    scrollModeBottom.value = false;
};

const outerClick = () => {
    // Trigger close event on all frames for backward compatibility
    frames.value.forEach((frame) => {
        if (frame && typeof (frame as any).$emit === "function") {
            (frame as any).$emit("close");
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

    setTimeout(() => {
        closed.value = true;
    }, 251);
};

// Expose methods for external access
defineExpose({
    frames,
    fade,
    stampMode,
    scrollModeTop,
    scrollModeBottom,
    closed,
    inputFocus,
    groupRef,
    changeStamp,
    first,
    second,
    clearScrollMode,
    outerClick,
    close,
    fadeIn,
    fadeOut
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
    z-index: 1000;

    &.background {
        background-color: rgba(221, 221, 221, 0.6);
    }

    &.blur {
        backdrop-filter: blur(5px) saturate(150%);
    }

    &.center {
        justify-content: center;
        align-items: center;
    }

    &.fadeIn {
        transition: 0.6s opacity cubic-bezier(0.19, 1, 0.22, 1);
        opacity: 1;

        .refresher-frame {
            transition: 0.5s transform cubic-bezier(0.19, 1, 0.22, 1);
            transform: translateY(0px);
        }
    }

    &.fadeOut {
        transition: 0.25s opacity cubic-bezier(0.19, 1, 0.22, 1);
        opacity: 0;
        pointer-events: none;

        .refresher-frame {
            transition: 0.25s transform cubic-bezier(0.19, 1, 0.22, 1);
            transform: translateY(10px);
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
        top: 20%;
        position: relative;

        p {
            font-size: 24px;
            letter-spacing: -1.66px;
            font-weight: bold;
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
