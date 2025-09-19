<template>
    <div
        ref="groupElement"
        class="refresher-group"
        @click="clickHandle"
        @wheel="wheelHandle"
    >
        <RefresherFrame
            v-for="(frame, i) in frames"
            :key="`frame${frame.id || i}`"
            :ref="(el) => setFrameRef(el, i)"
            :frame="frame"
            :index="i"
        />

        <div id="scroll">
            <img
                :src="getURL('/assets/upvote.webp')"
                @click="() => clickScroll('up')"
            />
            <img
                :src="getURL('/assets/downvote.webp')"
                @click="() => clickScroll('down')"
            />
        </div>
    </div>
</template>

<script lang="ts" setup>
import {getCurrentInstance, ref} from "vue";
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

const groupElement = ref<HTMLElement>();
const frameRefs = ref<any[]>([]);

const setFrameRef = (el: any, index: number) => {
    if (el) {
        frameRefs.value[index] = el;
    }
};

const instance = getCurrentInstance();

const clickScroll = (type: "up" | "down") => {
    if (groupElement.value) {
        const el = groupElement.value;
        const y = type === "up" ? 0 : el.scrollHeight;
        el.scroll(0, y);
    }
};

const clickHandle = (ev: MouseEvent) => {
    if (ev.target !== groupElement.value) return ev;

    const selection = window.getSelection();
    if (selection && selection.toString().length !== 0) return ev;

    props.outerClick?.();
};

const wheelHandle = (ev: WheelEvent) => {
    if (typeof props.onScroll === "function") props.onScroll(ev, instance, groupElement.value);
};

defineExpose({
    frameRefs
});
</script>

<style lang="scss" scoped>
#scroll {
    bottom: 5px;
    display: grid;
    position: fixed;
    right: 0;
    user-select: none;
    width: 100px;
    z-index: 1000;
}
</style>