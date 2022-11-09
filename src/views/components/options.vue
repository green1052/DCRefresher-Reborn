<template>
    <div class="refresher-options" :data-id="id" :data-on="on" v-on:click="toggle">
        <select :disabled="disabled">
            <option v-for="name in options" value="index">{{ name }}</option>
        </select>
    </div>
</template>

<script>
export default {
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
};
</script>