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
    const estimate = date.getTime() - Date.now();

    if (estimate < 3000) {
        return "잠시 후";
    }

    const abs = Math.abs(estimate);
    for (let f = 0; f < timeCounts.length; f++) {
        if (abs >= timeCounts[f]) {
            return Math.round(estimate / timeCounts[f]) + timeFilters[f] + " 후";
        }
    }

    return "이미 삭제 됨";
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

    updates.value = window.setInterval(() => {
        stamp.value = convertTime(props.date);
    }, 5000);
});

onBeforeUnmount(() => {
    if (updates.value !== null) {
        clearInterval(updates.value);
    }
});
</script>