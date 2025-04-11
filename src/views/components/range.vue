<template>
    <div class="refresher-range">
        <input
            :data-id="id"
            :data-module="modname"
            :disabled="disabled"
            :max="max"
            :min="min"
            :placeholder="placeholder"
            :step="step"
            :value="value"
            type="range"
            @change="update"
            @input="input"
        />
        <span class="indicator">{{ value + (unit ? unit : "") }}</span>
    </div>
</template>

<script lang="ts">
import $ from "cash-dom";
import Vue from "vue";

export default Vue.extend({
    name: "RefresherRange",
    props: {
        change: {
            type: Function
        },

        placeholder: {
            type: Number,
            required: false
        },

        modname: {
            type: String
        },

        id: {
            type: String
        },

        value: {
            type: Number
        },

        max: {
            type: Number
        },

        min: {
            type: Number
        },

        step: {
            type: Number
        },

        unit: {
            type: String
        },

        disabled: {
            type: Boolean
        }
    },
    mounted() {
        this.$data.__temp = this.value;
    },
    methods: {
        input(ev: Event) {
            $(this.$el)
                .find(".indicator")
                .html(`${ev.target.value}${this.unit ? this.unit : ""}`);
        },

        update(ev: Event) {
            this.change?.(ev.target.dataset.module, ev.target.dataset.id, Number(ev.target.value));
        }
    }
});
</script>
