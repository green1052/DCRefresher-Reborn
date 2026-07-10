import {onBeforeUnmount, ref, type Ref} from "vue";

import eventBus from "../core/eventbus";

interface UseMeDetectionOptions {
    userId: string;
    postUser?: string;
}

interface UseMeDetectionReturn {
    me: Ref<boolean>;
}

export function useMeDetection({userId, postUser}: UseMeDetectionOptions): UseMeDetectionReturn {
    const me = ref(false);
    let eventBusUuid: string | null = null;

    const checkGallogId = (): string | null => {
        const gallogImageElement = document.querySelector<HTMLElement>("#login_box .user_info .writer_nikcon");
        if (!gallogImageElement) return null;

        const clickAttr = gallogImageElement.getAttribute("onclick");
        if (!clickAttr) return null;

        return clickAttr.replace(/window\.open\('\/\/gallog\.dcinside\.com\//g, "").replace(/'\);/g, "");
    };

    const checkFixedName = (): { id: string; name: string } | null => {
        const fixedNameElement = document.querySelector("#login_box > .user_info .nickname > em");
        if (!fixedNameElement || !fixedNameElement.innerHTML) return null;

        const gallogIcon = document.querySelector<HTMLElement>("#login_box > .user_info > .writer_nikcon");
        if (!gallogIcon) return null;

        const attribute = gallogIcon.getAttribute("onclick");
        if (!attribute) return null;

        const match = /window\.open\('\/\/gallog\.dcinside\.com\/(\w*)'\);/.exec(attribute);
        if (!match || !match[1]) return null;

        return {id: match[1], name: fixedNameElement.innerHTML};
    };

    const setup = () => {
        if (!userId) return;

        const fixed = checkFixedName();
        if (fixed) {
            if (userId === fixed.id) {
                me.value = true;
            }
        }

        const gallogId = checkGallogId();
        if (gallogId) {
            me.value = gallogId === userId;
        }

        if (!me.value && postUser) {
            me.value = postUser === userId;
        }

        if (!me.value && !postUser) {
            eventBusUuid = eventBus.on("RefresherPostDataLoaded", (obj: IPostInfo) => {
                me.value = obj.user?.id === userId;
            });
        }
    };

    setup();

    onBeforeUnmount(() => {
        if (eventBusUuid) {
            eventBus.remove("RefresherPostDataLoaded", eventBusUuid, true);
        }
    });

    return {me};
}