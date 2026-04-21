<template>
    <img
        :alt="icon"
        :src="browser.runtime.getURL(`/assets/${icon}.webp`)"
        class="refresher-icon"
    />
</template>

<script lang="ts" setup>
interface Props {
    icon: string;
}

defineProps<Props>();
</script>