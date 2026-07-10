import {computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref} from "vue";

const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;

const timeCounts = [y, w, d, h, m, s];
const timeFilters = ["년", "주", "일", "시간", "분", "초"];

interface UseRelativeTimeOptions {
    date: Date;
    mode: "elapsed" | "remaining";
    interval?: number;
    fallbackText?: string;
}

interface UseRelativeTimeReturn {
    stampMode: Ref<boolean>;
    stamp: Ref<string>;
    locale: ComputedRef<string>;
    changeStamp: () => void;
}

export function useRelativeTime({date, mode, interval = 3000, fallbackText}: UseRelativeTimeOptions): UseRelativeTimeReturn {
    const convertTime = (target: Date): string => {
        const diff = mode === "elapsed"
            ? Date.now() - target.getTime()
            : target.getTime() - Date.now();

        const abs = Math.abs(diff);

        if (mode === "elapsed" && diff < 3000) return "방금 전";
        if (mode === "remaining" && diff < 3000) return "잠시 후";

        for (let f = 0; f < timeCounts.length; f++) {
            if (abs >= timeCounts[f]) {
                return Math.round(diff / timeCounts[f]) + timeFilters[f] + (mode === "elapsed" ? " 전" : " 후");
            }
        }

        return fallbackText ?? (mode === "elapsed" ? "아주 오래 전" : "이미 삭제 됨");
    };

    const stampMode = ref(false);
    const stamp = ref("");
    const updates = ref<ReturnType<typeof setInterval> | null>(null);

    const locale = computed(() => date.toLocaleString());

    const changeStamp = () => {
        stampMode.value = !stampMode.value;
    };

    onMounted(() => {
        stamp.value = convertTime(date);
        updates.value = setInterval(() => {
            stamp.value = convertTime(date);
        }, interval);
    });

    onBeforeUnmount(() => {
        if (updates.value !== null) {
            clearInterval(updates.value);
        }
    });

    return {stampMode, stamp, locale, changeStamp};
}