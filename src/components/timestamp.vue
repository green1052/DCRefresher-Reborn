<template>
    <div
        :title="locale"
        :class="mode === 'remaining' ? 'refresher-countdown' : 'refresher-timestamp'"
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
    mode?: "elapsed" | "remaining";
}

const props = withDefaults(defineProps<Props>(), {
    mode: "elapsed"
});

const {stampMode, stamp, locale, changeStamp} = useRelativeTime({
    date: () => props.date,
    mode: props.mode,
    interval: props.mode === "remaining" ? 5000 : 3000
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

.refresher-countdown {
    font-size: 12px;
    font-weight: 100;
    opacity: 0.6;
    color: var(--refresher-danger);
}
</style>
