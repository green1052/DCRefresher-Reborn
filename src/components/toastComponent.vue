<template>
    <transition appear name="refresher-toast">
        <div
            v-show="this.open"
            :key="this.id"
            :class="{ hover: this.clickCb }"
            :data-type="this.type"
            :title="this.content"
            class="refresher-toast"
        >
            <div class="contents" @click="click">
                <div class="text">
                    <p>{{ this.content }}</p>
                </div>
                <div class="button" @click="this.hide">
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
    name: "refresher-toast",
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
                this.autoClose = window.setTimeout(
                    this.hide,
                    typeof autoClose === "number" ? autoClose : 5000
                );
        },

        show() {
            this.open = true;
        },

        hide() {
            this.open = false;
        }
    },
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
    }
});
</script>
