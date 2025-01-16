<template>
    <div
        class="refresher-group"
        @click="clickHandle"
        @wheel="wheelHandle">
        <refresher-frame
            v-for="(frame, i) in this.$root.$children[0].$data.frames"
            :key="`frame${Math.random()}`"
            :frame="frame"
            :index="i"/>

        <div id="scroll">
            <img
                :src="getURL(`/assets/icons/upvote.webp`)"
                @click="(e) => clickScroll(e, `up`)"/>
            <img
                :src="getURL(`/assets/icons/downvote.webp`)"
                @click="(e) => clickScroll(e, `down`)"/>
        </div>
    </div>
</template>

<script lang="ts">
import frame from "./frame.vue";
import Vue from "vue";
import {getURL} from "../utils/getURL";

export default Vue.extend({
    name: "refresher-group",
    components: {
        "refresher-frame": frame
    },
    methods: {
        getURL,
        clickScroll(ev: MouseEvent, type: "up" | "down") {
            const y = type === "up" ? 0 : this.$el.scrollHeight;
            this.$el.scroll(0, y);
        },

        clickHandle(ev: MouseEvent) {
            if (ev.target !== this.$el) return ev;

            if (window.getSelection()?.toString().length !== 0) return ev;

            (this.$root.$children[0] as RefresherFrameAppVue).outerClick();
        },

        wheelHandle(e: WheelEvent) {
            const onScroll = (
                this.$root.$children[0] as RefresherFrameAppVue
            ).$data.onScroll;

            if (typeof onScroll !== "function") return;

            onScroll(e, this.$root.$children[0], this.$el);
        }
    }
});
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
