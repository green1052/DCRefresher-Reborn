import {onBeforeUnmount, ref, type Ref} from "vue";

import eventBus from "@/core/eventbus";
import {getLoggedInUserInfo} from "@/utils/user";

interface UseMeDetectionOptions {
    userId: string;
    postUser?: string;
}

interface UseMeDetectionReturn {
    me: Ref<boolean>;
}

export function useMeDetection({userId, postUser}: UseMeDetectionOptions): UseMeDetectionReturn {
    const me = ref(false);
    let eventBusUuid: (() => void) | null = null;

    const setup = () => {
        if (!userId) return;

        // getLoggedInUserInfo가 로그인 박스에서 gallog ID를 이미 추출한다.
        const fixed = getLoggedInUserInfo();
        if (fixed?.id) {
            me.value = fixed.id === userId;
        }

        if (!me.value && postUser) {
            me.value = postUser === userId;
        }

        if (!me.value && !postUser) {
            eventBusUuid = eventBus.on("RefresherPostDataLoaded", (obj) => {
                me.value = obj.user?.id === userId;
            });
        }
    };

    setup();

    onBeforeUnmount(() => {
        if (eventBusUuid) {
            eventBusUuid();
        }
    });

    return {me};
}