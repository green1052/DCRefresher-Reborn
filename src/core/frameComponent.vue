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
import { getCurrentInstance, onMounted, ref, watch } from "vue";

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
const activeGroup = ref(props.option && props.option.groupOnce ? props.option.groupOnce : false);
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
const stack = ref(props.option && props.option.stack ? props.option.stack : false);
const groupOnce = ref(props.option && props.option.groupOnce ? props.option.groupOnce : false);
const onScroll = props.option && props.option.onScroll ? props.option.onScroll : undefined;

// Watch for closed state changes
watch(closed, (val: boolean) => {
    document.body.style.overflow = val ? "auto" : "hidden";
});

// Component instance for global event handling
const instance = getCurrentInstance();

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
    activeGroup,
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
