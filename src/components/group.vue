<template>
    <div
        class="refresher-group"
        @click="clickHandle"
        @wheel="wheelHandle"
    >
        <RefresherFrame
            v-for="(frame, i) in frames"
            :key="`frame${frame.id || i}`"
            :frame="frame"
            :index="i"
        />

        <div id="scroll">
            <img
                :src="getURL(`/assets/icons/upvote.webp`)"
                alt="Scroll up"
                @click="(e) => clickScroll(e, 'up')"
            />
            <img
                :src="getURL(`/assets/icons/downvote.webp`)"
                alt="Scroll down"
                @click="(e) => clickScroll(e, 'down')"
            />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { getCurrentInstance } from "vue";

import getURL from "../utils/getURL";
import RefresherFrame from "./frame.vue";

interface Props {
    frames?: any[];
    onScroll?: (e: WheelEvent, app: any, el: HTMLElement) => void;
    outerClick?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
    frames: () => []
});

// Get current instance to access parent data
const instance = getCurrentInstance();
const parentData = instance && instance.parent ? instance.parent.proxy : null;

const clickScroll = (ev: MouseEvent, type: "up" | "down") => {
    if (instance && instance.proxy && instance.proxy.$el) {
        const el = instance.proxy.$el as HTMLElement;
        const y = type === "up" ? 0 : el.scrollHeight;
        el.scroll(0, y);
    }
};

const clickHandle = (ev: MouseEvent) => {
    if (instance && instance.proxy && instance.proxy.$el) {
        const el = instance.proxy.$el as HTMLElement;
        if (ev.target !== el) return ev;
    }

    const selection = window.getSelection();
    if (selection && selection.toString().length !== 0) return ev;

    if (props.outerClick) {
        props.outerClick();
    }
};

const wheelHandle = (e: WheelEvent) => {
    if (typeof props.onScroll !== "function") return;

    if (instance && instance.proxy && instance.proxy.$el) {
        const el = instance.proxy.$el as HTMLElement;
        props.onScroll(e, instance.proxy, el);
    }
};
</script>

<style lang="scss" scoped>
#scroll {
    position: fixed;
    right: 0;
    bottom: 5px;
    width: 100px;
    z-index: 1000;
    display: grid;
    user-select: none;
}
</style>
