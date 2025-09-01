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
import {computed, onBeforeUnmount, onMounted, ref} from "vue";

interface Props {
    date: Date;
}

const props = defineProps<Props>();

const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;

const timeCounts = [y, w, d, h, m, s];
const timeFilters = ["년", "주", "일", "시간", "분", "초"];

const convertTime = (date: Date) => {
    const elapsed = Date.now() - date.getTime();

    if (elapsed < 3000) {
        return "방금 전";
    }

    const abs = Math.abs(elapsed);

    for (let f = 0; f < timeCounts.length; f++) {
        if (abs >= timeCounts[f]) {
            return Math.round(elapsed / timeCounts[f]) + timeFilters[f] + " 전";
        }
    }

    return "아주 오래 전";
};

const stampMode = ref(false);
const stamp = ref("");
const updates = ref<number | null>(null);

const locale = computed(() => props.date.toLocaleString());

const changeStamp = () => {
    stampMode.value = !stampMode.value;
};

onMounted(() => {
    stamp.value = convertTime(props.date);

    updates.value = setInterval(() => {
        stamp.value = convertTime(props.date);
    }, 3000);
});

onBeforeUnmount(() => {
    if (updates.value) {
        clearInterval(updates.value);
    }
});
</script>