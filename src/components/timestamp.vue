<template>
    <div
        :title="locale"
        class="refresher-timestamp"
        @click="changeStamp"
    >
        <transition name="refresher-opacity">
            <span :key="'stamp' + stampMode">
                {{ stampMode ? locale : stamp }}
            </span>
        </transition>
    </div>
</template>

<script lang="ts" setup>
import {useRelativeTime} from "@/composables/useRelativeTime";

interface Props {
    date: Date;
}

const props = defineProps<Props>();

const {stampMode, stamp, locale, changeStamp} = useRelativeTime({
    date: () => props.date,
    mode: "elapsed",
    interval: 3000
});
</script>

<style lang="scss" scoped>
.refresher-timestamp {
    cursor: pointer;
    text-align: right;
    font-size: 12px;
    font-weight: 100;
    opacity: 0.6;
}
</style>