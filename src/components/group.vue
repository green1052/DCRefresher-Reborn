<template>
    <div class="refresher-group" @click="clickHandle">
        <refresher-frame v-for="(frame, i) in frames" :key="'frame' + Math.random()" :frame="frame"
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
    data() {
        return {
            frames: (this.$root.$children[0] as RefresherFrameAppVue).frames
        };
    },
    methods: {
        clickHandle(ev: Event) {
            if (ev.target !== this.$el) return ev;
            (this.$root.$children[0] as RefresherFrameAppVue).outerClick();
        }
    }
});
</script>
