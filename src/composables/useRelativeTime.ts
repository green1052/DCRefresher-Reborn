import {
    computed,
    type ComputedRef,
    type MaybeRefOrGetter,
    onBeforeUnmount,
    onMounted,
    ref,
    type Ref,
    toValue
} from "vue";

const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;

const timeCounts = [y, w, d, h, m, s];
const timeFilters = ["년", "주", "일", "시간", "분", "초"];

interface UseRelativeTimeOptions {
    // getter로 넘겨야 date가 바뀔 때(미리보기 글 이동 등) 표시도 따라간다
    date: MaybeRefOrGetter<Date>;
    mode: "elapsed" | "remaining";
    interval?: number;
    fallbackText?: string;
}

interface UseRelativeTimeReturn {
    stampMode: Ref<boolean>;
    stamp: ComputedRef<string>;
    locale: ComputedRef<string>;
    changeStamp: () => void;
}

export function useRelativeTime({
                                    date,
                                    mode,
                                    interval = 3000,
                                    fallbackText
                                }: UseRelativeTimeOptions): UseRelativeTimeReturn {
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
    const tick = ref(0);
    let updates: ReturnType<typeof setInterval> | null = null;

    // tick(주기 갱신)과 date 변경 양쪽 모두에 반응한다
    const stamp = computed(() => {
        void tick.value;
        return convertTime(toValue(date));
    });
    const locale = computed(() => toValue(date).toLocaleString());

    const changeStamp = () => {
        stampMode.value = !stampMode.value;
    };

    onMounted(() => {
        updates = setInterval(() => {
            // 숨김 탭에서는 표시 갱신이 무의미하므로 스킵
            if (document.hidden) return;
            tick.value++;
        }, interval);
    });

    onBeforeUnmount(() => {
        if (updates !== null) {
            clearInterval(updates);
        }
    });

    return {stampMode, stamp, locale, changeStamp};
}