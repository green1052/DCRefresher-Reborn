<template>
    <div :class="{background: this.$root.$children[0].background, blur: this.$root.$children[0].blur, fadeIn: this.$root.$children[0].fade, fadeOut: !this.$root.$children[0].fade, stack: this.$root.$children[0].fade}"
         class="refresher-frame-outer">
        <refresher-group/>
        <transition name="refresher-prev-post">
            <refresher-scroll v-show="this.$root.$children[0].scrollModeTop" side="top"/>
        </transition>
        <transition name="refresher-next-post">
            <refresher-scroll v-show="this.$root.$children[0].scrollModeBottom" side="bottom"/>
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