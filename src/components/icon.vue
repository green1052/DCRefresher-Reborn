<template>
    <img
        :alt="icon"
        :src="getURL(`/assets/icons/${icon}.webp`)"
        class="refresher-icon"
    />
</template>

<script lang="ts" setup>
import getURL from "../utils/getURL";

interface Props {
    icon: string;
}

defineProps<Props>();
</script>
