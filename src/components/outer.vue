<template>
    <div
        :class="{background: this.$root.$children[0].$data.background, blur: this.$root.$children[0].$data.blur, fadeIn: this.$root.$children[0].$data.fade, fadeOut: !this.$root.$children[0].$data.fade, stack: this.$root.$children[0].$data.fade}"
        class="refresher-frame-outer">
        <refresher-group/>
        <transition name="refresher-prev-post">
            <refresher-scroll v-show="this.$root.$children[0].$data.scrollModeTop" side="top"/>
        </transition>
        <transition name="refresher-next-post">
            <refresher-scroll v-show="this.$root.$children[0].$data.scrollModeBottom" side="bottom"/>
        </transition>
    </div>
</template>

<script lang="ts">
import group from "./group.vue";
import scroll from "./scroll.vue";
import Vue from "vue";

export default Vue.extend({
    name: "refresher-frame-outer",
    components: {
        "refresher-group": group,
        "refresher-scroll": scroll
    }
});
</script>