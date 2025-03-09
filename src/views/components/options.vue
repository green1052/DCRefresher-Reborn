<template>
    <select
        v-model="value"
        :data-id="id"
        :data-module="modname"
        :disabled="disabled"
        class="refresher-options"
        @change="update"
    >
        <option v-for="(value, key) in options" :value="key">
            {{ value }}
        </option>
    </select>
</template>

<script lang="ts">
import Vue, { PropType } from "vue";

export default Vue.extend({
    name: "refresher-options",
    props: {
        change: {
            type: Function
        },

        modname: {
            type: String
        },

        options: {
            type: Object as PropType<Record<string, string>>
        },

        id: {
            type: String
        },

        value: {
            type: String
        },

        disabled: {
            type: Boolean
        }
    },
    methods: {
        update(ev: any) {
            this.change?.(ev.target.dataset.module, ev.target.dataset.id, ev.target.value);
        }
    }
});
</script>
