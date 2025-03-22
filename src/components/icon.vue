<template>
    <img :src="getURL(`/assets/icons/${icon}.webp`)" />
</template>

<script lang="ts">
    import Vue from "vue";

    import { getURL } from "../utils/getURL";

    export default Vue.extend({
        name: "Icon",
        props: {
            icon: {
                type: String,
                required: true
            }
        },
        methods: {
            getURL
        }
    });
</script>
