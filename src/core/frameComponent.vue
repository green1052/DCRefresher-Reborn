<template>
    <div
        v-show="!closed"
        :class="{
            background: background,
            blur: blur,
            fadeIn: fade,
            fadeOut: !fade,
            stack: fade
        }"
        class="refresher-frame-outer"
    >
        <refresher-group />
        <transition name="refresher-prev-post">
            <refresher-scroll v-show="scrollModeTop" side="top" />
        </transition>
        <transition name="refresher-next-post">
            <refresher-scroll v-show="scrollModeBottom" side="bottom" />
        </transition>
    </div>
</template>

<script lang="ts">
import scroll from "../components/scroll.vue";
import Vue, { PropType } from "vue";
import { FrameStackOption } from "./frame";
import group from "../components/group.vue";

interface FrameComponentData extends FrameStackOption {
    frames: RefresherFrame[];
    activeGroup: boolean;
    fade: boolean;
    stampMode: boolean;
    scrollModeTop: boolean;
    scrollModeBottom: boolean;
    closed: boolean;
    inputFocus: boolean;
}

export default Vue.extend({
    name: "refresher-frame-outer",
    components: {
        Scroll: scroll,
        "refresher-group": group,
        "refresher-scroll": scroll
    },
    props: {
        option: {
            type: Object as PropType<FrameStackOption>
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
            closed: false,
            inputFocus: false
        };
    },
    watch: {
        closed: (val: boolean) => {
            document.body.style.overflow = val ? "auto" : "hidden";
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
        },

        close() {
            this.outerClick();
        },

        fadeIn() {
            this.fade = true;
            this.closed = false;
        },

        fadeOut() {
            this.fade = false;

            setTimeout(() => {
                this.closed = true;
            }, 251);
        }
    }
});
</script>
