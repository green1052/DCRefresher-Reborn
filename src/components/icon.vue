<template>
    <img
        :alt="icon"
        :src="getAssetURL(icon)"
        class="refresher-icon"
    />
</template>

<script lang="ts" setup>
import {getAssetURL} from "../utils/assetURL";

interface Props {
    icon: string;
}

defineProps<Props>();
</script>