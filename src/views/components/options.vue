<template>
    <div :data-id="id" :data-on="on" class="refresher-options" v-on:click="toggle">
        <select :disabled="disabled">
            <option v-for="name in options" value="index">{{ name }}</option>
        </select>
    </div>
</template>

<script>
import Vue from "vue";

export default Vue.extend({
    name: "refresher-options",
    props: {
        options: {
            type: Array
        },

        id: {
            type: String
        },

        disabled: {
            type: Boolean
        }
    }
});
</script>