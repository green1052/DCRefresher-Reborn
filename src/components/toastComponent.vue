<template>
    <transition appear name="refresher-toast">
        <div v-show="this.open" :key="this.id" :class="{hover: this.clickCb}"
             :data-type="this.type" :title="this.content" class="refresher-toast">
            <div class="contents" v-on:click="click">
                <div class="text">
                    <p>{{ this.content }}</p>
                </div>
                <div class="button" v-on:click="this.hide">
                    <i class="material-icons">X</i>
                </div>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
    name: "refresher-toast",
    methods: {
        click(ev) {
            if (this.clickCb) {
                this.clickCb(ev.target);
            }
        },

        update(
            content: string,
            type: string,
            autoClose: boolean,
            click?: () => void
        ) {
            this.content = content;
            this.id = Math.random();
            this.type = typeof type === "boolean" ? (type ? "error" : "info") : type;
            this.clickCb = click;

            if ((typeof autoClose !== "boolean" && !autoClose) || autoClose) {
                this.autoClose = setTimeout(
                    this.hide,
                    autoClose && typeof autoClose === "number" ? autoClose : 5000
                );
            }
        },

        show() {
            this.open = true;
        },

        hide() {
            this.open = false;
        }
    },
    data: () => {
        return {
            title: "",
            id: 0,
            content: "",
            clickCb: () => {
            },
            open: false,
            type: "",
            autoClose: 0
        };
    }
});
</script>