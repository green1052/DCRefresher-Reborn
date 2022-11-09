<template>
    <img :src="getURL(`/assets/icons/${icon}.png`)"/>
</template>

<script lang="ts">
import browser from "webextension-polyfill";

export default {
    name: "icon",
    props: {
        icon: {
            type: String,
            required: true
        }
    },
    methods: {
        getURL (u: string): string {
            return browser.runtime.getURL(u);
        }
    }
};
</script>