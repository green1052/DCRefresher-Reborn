<template>
    <div
        :title="locale"
        class="refresher-countdown"
        @click="changeStamp"
    >
        <transition name="refresher-opacity">
            <span :key="`stamp${stampMode}`">
                {{ stampMode ? locale : stamp }}
            </span>
        </transition>
    </div>
</template>

<script lang="ts" setup>
import {useRelativeTime} from "./useRelativeTime";

interface Props {
    date: Date;
}

const props = defineProps<Props>();

const {stampMode, stamp, locale, changeStamp} = useRelativeTime({
    date: props.date,
    mode: "remaining",
    interval: 5000
});
</script>

<style lang="scss" scoped>
.refresher-countdown {
    font-size: 12px;
    font-weight: 100;
    opacity: 0.6;
    color: var(--refresher-danger);
}
</style>