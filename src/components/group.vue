<template>
    <div class="refresher-group" @click="clickHandle" @wheel="wheelHandle">
        <refresher-frame v-for="(frame, i) in this.$root.$children[0].$data.frames" :key="`frame${Math.random()}`"
                         :frame="frame"
                         :index="i"/>
    </div>
</template>

<script lang="ts">
import frame from "./frame.vue";
import Vue from "vue";

export default Vue.extend({
    name: "refresher-group",
    components: {
        "refresher-frame": frame
    },
    methods: {
        clickHandle(ev: MouseEvent) {
            if (ev.target !== this.$el) return ev;
            (this.$root.$children[0] as RefresherFrameAppVue).outerClick();
        },

        wheelHandle(ev: WheelEvent) {
            const onScroll = (this.$root.$children[0] as RefresherFrameAppVue).$data.onScroll;

            if (typeof onScroll !== "function") return;

            onScroll(ev, this.$root.$children[0], this.$el);
        }
    }
});
</script>
