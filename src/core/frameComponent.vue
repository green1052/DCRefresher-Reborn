<template>
    <Outer :style="{display: closed ? 'none' : ''}"/>
</template>

<script lang="ts">
import outer from "../components/outer.vue";
import scroll from "../components/scroll.vue";
import Vue, {PropType} from "vue";
import {FrameStackOption} from "./frame";

interface FrameComponentData extends FrameStackOption {
    frames: RefresherFrame[],
    activeGroup: boolean;
    fade: boolean;
    stampMode: boolean;
    scrollModeTop: boolean;
    scrollModeBottom: boolean;
    closed: boolean;
}

export default Vue.extend({
    name: "refresher-frame-outer",
    components: {
        Outer: outer,
        Scroll: scroll
    },
    props: {
        option: {
            type: Object as PropType<FrameStackOption>,
        }
    },
    data: function (): FrameComponentData {
        return {
            ...this.option,
            frames: [],
            activeGroup: this.option.groupOnce!,
            fade: false,
            stampMode: false,
            scrollModeTop: false,
            scrollModeBottom: false,
            closed: false
        };
    },
    watch: {
        closed: (val) => {
            document.body.style.overflow = val === true ? "auto" : "hidden";
        }
    },
    created() {
        document.body.style.overflow = "hidden";

        document.addEventListener("keyup", (ev) => {
            if (ev.code === "Escape" && !closed) this.outerClick();
        });
    },
    methods: {
        changeStamp() {
            this.stampMode = !this.stampMode;
        },

        first() {
            return this.frames[0];
        },

        second() {
            return this.frames[1];
        },

        clearScrollMode() {
            this.scrollModeTop = false;
            this.scrollModeBottom = false;
        },

        outerClick() {
            this.$emit("close");
            this.fadeOut();
            this.$data.closed = true;
        },

        close() {
            this.outerClick();
        },

        fadeIn() {
            this.$data.fade = true;
            this.$data.closed = false;
        },

        fadeOut() {
            this.$data.fade = false;
        }
    }
});
</script>