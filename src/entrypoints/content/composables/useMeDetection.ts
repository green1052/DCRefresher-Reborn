import {useEffect, useState} from "react";

import eventBus from "@/core/eventbus";
import {getLoggedInUserInfo} from "@/utils/user";

interface UseMeDetectionOptions {
    userId: string;
    postUser?: string;
}

export function useMeDetection({userId, postUser}: UseMeDetectionOptions): { me: boolean } {
    const [me, setMe] = useState(false);

    useEffect(() => {
        if (!userId) return;

        // getLoggedInUserInfo가 로그인 박스에서 gallog ID를 이미 추출한다.
        const fixed = getLoggedInUserInfo();

        let matched = false;
        if (fixed?.id) {
            matched = fixed.id === userId;
            setMe(matched);
        }

        let eventBusUuid: (() => void) | null = null;

        if (!matched && postUser) {
            setMe(postUser === userId);
        } else if (!matched && !postUser) {
            eventBusUuid = eventBus.on("RefresherPostDataLoaded", (obj) => {
                setMe(obj.user?.id === userId);
            });
        }

        return () => {
            if (eventBusUuid) {
                eventBusUuid();
            }
        };
    }, [userId, postUser]);

    return {me};
}
