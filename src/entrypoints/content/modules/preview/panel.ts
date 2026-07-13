import type {App} from "vue";

import blockPopup from "./components/popup/blockPopup.vue";
import captchaPopup from "./components/popup/captchaPopup.vue";
import adminPanel from "./components/popup/adminPanel.vue";

import type Frame from "./frame";
import type {PreviewRequest} from "./request";
import type {TypedEventBus} from "@/core/eventbus";
import toast from "@/utils/toast";

export interface BlockPreset {
    day: string;
    reason: string;
    delete: boolean;
    user_type: boolean;
}

export const blockPreset: BlockPreset = {
    day: "",
    reason: "",
    delete: false,
    user_type: false
};

interface MountedPopup {
    app: App;
    element: HTMLDivElement;
}

const mountedPopups = new Set<MountedPopup>();

const mountPopup = (component: typeof blockPopup | typeof captchaPopup | typeof adminPanel, props: Record<string, unknown>): MountedPopup => {
    const element = document.createElement("div");
    const app = createApp(component, props);
    app.mount(element);
    document.body.appendChild(element);
    const instance = {app, element};
    mountedPopups.add(instance);
    return instance;
};

const unmountPopup = (instance: MountedPopup): void => {
    instance.app.unmount();
    instance.element.remove();
    mountedPopups.delete(instance);
};

export const closeAllPopups = (): void => {
    for (const instance of mountedPopups) {
        instance.app.unmount();
        instance.element.remove();
    }
    mountedPopups.clear();
};

export const panel = {
    block(
        callback: (
            avoidHour: number,
            avoidReason: number,
            avoidReasonTxt: string,
            delChk: number,
            userType: number
        ) => void,
        closeCallback: () => void
    ): void {
        const instance = mountPopup(blockPopup, {
            onSubmit: (payload: {
                avoidHour: number;
                avoidReason: number;
                avoidReasonTxt: string;
                delChk: number;
                userType: number
            }) => {
                callback(payload.avoidHour, payload.avoidReason, payload.avoidReasonTxt, payload.delChk, payload.userType);
                unmountPopup(instance);
            },
            onClose: () => {
                closeCallback();
                unmountPopup(instance);
            }
        });
    },

    admin(
        preData: GalleryPreData,
        frame: Frame,
        toggleBlur: boolean,
        eventBus: TypedEventBus,
        useKeyPress: boolean,
        request: PreviewRequest
    ): void {
        closeAllPopups();

        mountPopup(adminPanel, {
            preData,
            toggleBlur,
            useKeyPress,
            request,
            blockPreset,
            closeFrame: () => frame.app?.close(),
            emitRefreshRequest: () => eventBus.emit("refreshRequest"),
            onOpenBlock: () => {
                panel.block(
                    (avoidHour, avoidReason, avoidReasonTxt, delChk, userType) => {
                        request.block(preData, avoidHour, avoidReason, avoidReasonTxt, delChk, userType).then((response) => {
                            eventBus.emit("refreshRequest");

                            if (typeof response === "object" && response !== null) {
                                const r = response as { msg: string; result: string };
                                if (r.result === "success") {
                                    toast.show(r.msg);
                                    if (delChk) frame.app?.close();
                                } else {
                                    toast.show(r.msg, "error");
                                }
                                return;
                            }

                            toast.show(String(response), "error");
                        });
                    },
                    () => {}
                );
            }
        });
    },

    async captcha(src: string, callback: (captcha: string) => void): Promise<boolean> {
        const instance = mountPopup(captchaPopup, {
            src,
            onSubmit: (captcha: string) => {
                callback(captcha);
                unmountPopup(instance);
            },
            onClose: () => {
                unmountPopup(instance);
            }
        });

        return true;
    }
};
