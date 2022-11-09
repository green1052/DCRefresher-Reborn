<template>
    <Outer/>
</template>

<script>
import outer from "../components/outer";
import scroll from "../components/scroll";

export default {
    name: "refresher-frame-outer",
    components: {
        Outer: outer,
        Scroll: scroll,
    },
    props: {
        option: {
            type: Object
        }
    },
    data: ({$props}) => {
        return {
            frames: [],
            ...$props.option,
            activeGroup: $props.option.groupOnce,
            fade: false,
            stampMode: false,
            scrollModeTop: false,
            scrollModeBottom: false,
            closed: false
        };
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
            document.body.style.overflow = "auto";

            setTimeout(() => {
                document.body.removeChild(this.$el);
            }, 300);

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
};
</script>