import {onBeforeUnmount, ref, watch} from "vue";

// 프레임 페이드 인/아웃 전환 관리 컴포저블
// closed 상태에 따라 body overflow 제어, fadeOutTimer 관리
export function useFrameFade(onClosed?: () => void) {
    const fade = ref(false);
    const closed = ref(false);
    let fadeOutTimer: number | null = null;

    watch(closed, (val: boolean) => {
        document.body.style.overflow = val ? "" : "hidden";
        if (val) onClosed?.();
    });

    const fadeIn = () => {
        fade.value = true;
        closed.value = false;
    };

    const fadeOut = () => {
        fade.value = false;

        if (fadeOutTimer !== null) {
            window.clearTimeout(fadeOutTimer);
        }

        fadeOutTimer = window.setTimeout(() => {
            closed.value = true;
            fadeOutTimer = null;
        }, 251);
    };

    onBeforeUnmount(() => {
        document.body.style.overflow = "";
        if (fadeOutTimer !== null) {
            window.clearTimeout(fadeOutTimer);
            fadeOutTimer = null;
        }
    });

    return {fade, closed, fadeIn, fadeOut};
}