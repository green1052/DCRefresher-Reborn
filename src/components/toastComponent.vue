<template>
    <transition
        appear
        name="refresher-toast"
    >
        <div
            v-show="open"
            :key="id"
            :class="{ hover: clickCb }"
            :data-type="type"
            :title="content"
            class="refresher-toast"
        >
            <div
                class="contents"
                @click="click"
            >
                <div class="text">
                    <p>{{ content }}</p>
                </div>
                <div
                    class="button"
                    @click="hide"
                >
                    <i class="material-icons">X</i>
                </div>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import Vue from "vue";

interface RefresherProps {
    title: string;
    id: number;
    content: string;
    clickCb: ((e: MouseEvent) => void) | null;
    open: boolean;
    type: "info" | "error" | null;
    autoClose: number;
}

export default Vue.extend({
    name: "RefresherToast",
    data: (): RefresherProps => {
        return {
            title: "",
            id: 0,
            content: "",
            clickCb: null,
            open: false,
            type: null,
            autoClose: 0
        };
    },
    methods: {
        click(e: MouseEvent) {
            this.clickCb?.(e);
        },

        update(content: string, type: boolean, autoClose: boolean | number, click?: () => void) {
            this.content = content;
            this.id = Math.random();
            this.type = type ? "error" : "info";

            if (click !== undefined) this.clickCb = click;

            if ((typeof autoClose === "number" && autoClose > 0) || autoClose === true)
                this.autoClose = window.setTimeout(this.hide, typeof autoClose === "number" ? autoClose : 5000);
        },

        show() {
            this.open = true;
        },

        hide() {
            this.open = false;
        }
    }
});
</script>
