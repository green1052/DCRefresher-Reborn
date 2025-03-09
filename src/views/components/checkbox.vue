<template>
    <div
        :class="{ disabled: disabled }"
        :data-id="id"
        :data-module="modname"
        :data-on="on"
        class="refresher-checkbox"
        @click="toggle"
    >
        <div
            :style="{
                transform:
                    'translateX(' +
                    (typeof translateX !== 'undefined' ? translateX : this.on ? 18 : 0) +
                    'px)'
            }"
            class="selected"
            @pointerdown="down"
            @pointermove="hover"
            @pointerout="out"
            @pointerup="up"
        ></div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
    name: "refresher-checkbox",

    props: {
        change: {
            type: Function
        },

        modname: {
            type: String,
            required: false
        },

        id: {
            type: String
        },

        checked: {
            type: Boolean
        },

        disabled: {
            type: Boolean
        }
    },

    data() {
        return {
            on: this.checked,
            _down: false,
            translateX: undefined,
            onceOut: false
        };
    },

    methods: {
        toggle() {
            if (this.disabled) {
                return;
            }

            if (this.onceOut) {
                this.onceOut = false;

                return;
            }

            this.on = !this.on;

            this.change?.(this.$el.dataset.module, this.$el.dataset.id, this.on);
        },

        hover(ev: PointerEvent) {
            if (this.disabled) {
                return;
            }

            if (this._down) {
                this.translateX = Math.ceil(ev.offsetX);
            }
        },

        down() {
            if (this.disabled) {
                return;
            }

            this._down = true;
        },

        up() {
            if (this.disabled) {
                return;
            }

            this._down = false;
            this.translateX = undefined;
        },
        out() {
            if (this.disabled) {
                return;
            }

            if (this._down) {
                this._down = false;
                this.translateX = undefined;
                this.toggle();

                this.onceOut = true;
            }
        }
    }
});
</script>
