<template>
    <div class="refresher-group" @click="clickHandle" @wheel="wheelHandle">
        <refresher-frame v-for="(frame, i) in this.$root.$children[0].$data.frames" :key="`frame${Math.random()}`"
                         :frame="frame"
                         :index="i"/>

        <div id="scroll">
            <img @click="(e) => clickScroll(e, `up`)" :src="getUrl(`/assets/icons/upvote.png`)"/>
            <img @click="(e) => clickScroll(e, `down`)" :src="getUrl(`/assets/icons/downvote.png`)"/>
        </div>
    </div>
</template>

<script lang="ts">
import browser from "webextension-polyfill";
import frame from "./frame.vue";
import Vue from "vue";

export default Vue.extend({
    name: "refresher-group",
    components: {
        "refresher-frame": frame
    },
    methods: {
        getUrl(url: string) {
            return browser.runtime.getURL(url);
        },

        clickScroll(e: MouseEvent, type: "up" | "down") {
            const y = type === "up" ? 0 : this.$el.scrollHeight;
            this.$el.scroll(0, y);
        },

        clickHandle(e: MouseEvent) {
            if (e.target !== this.$el) return e;
            (this.$root.$children[0] as RefresherFrameAppVue).outerClick();
        },

        wheelHandle(e: WheelEvent) {
            const onScroll = (this.$root.$children[0] as RefresherFrameAppVue).$data.onScroll;

            if (typeof onScroll !== "function") return;

            onScroll(e, this.$root.$children[0], this.$el);
        }
    }
});
</script>

<style scoped lang="scss">
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