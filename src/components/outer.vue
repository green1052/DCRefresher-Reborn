<template>
    <div class="refresher-frame-outer" :class="{background: this.$root.$children[0].background, blur: this.$root.$children[0].blur, fadeIn: this.$root.$children[0].fade, fadeOut: !this.$root.$children[0].fade, stack: this.$root.$children[0].fade}" >
        <refresher-group/>
        <transition name="refresher-prev-post">
            <refresher-scroll side="top" v-show="this.$root.$children[0].scrollModeTop"/>
        </transition>
        <transition name="refresher-next-post">
            <refresher-scroll side="bottom" v-show="this.$root.$children[0].scrollModeBottom"/>
        </transition>
    </div>
</template>

<script>
import group from "./group";
import scroll from "./scroll";

export default {
    name: "refresher-frame-outer",
    components: {
        "refresher-group": group,
        "refresher-scroll": scroll
    }
};
</script>