import type {App} from "vue";

import blockPopup from "./components/popup/blockPopup.vue";
import captchaPopup from "./components/popup/captchaPopup.vue";
import adminPanel from "./components/popup/adminPanel.vue";

import type Frame from "./frame";
import {previewRequest, type PreviewRequest} from "./request";
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
        unmountPopup(instance);
    }
    mountedPopups.clear();
};

// 캡차가 필요하면 팝업을 거쳐, 아니면 바로 요청 실행. 추천/댓글 작성 공용.
export async function requestWithCaptcha(
    preData: GalleryPreData,
    kcaptchaType: "comment" | "recommend",
    required: boolean,
    req: (captcha?: string) => Promise<boolean>
): Promise<boolean> {
    if (!required) return req();

    const src = await previewRequest.captcha(preData, kcaptchaType);
    return panel.captcha(src, req);
}

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

    // 콜백(추천/댓글 요청)의 실제 결과로 resolve한다. 닫으면 false.
    // 프레임 닫힘 등으로 closeAllPopups가 팝업을 제거하면 영영 resolve되지 않지만,
    // 그 시점엔 결과를 기다리는 쪽도 함께 사라지므로 무해하다.
    captcha(src: string, callback: (captcha: string) => Promise<boolean> | boolean): Promise<boolean> {
        return new Promise((resolve) => {
            const instance = mountPopup(captchaPopup, {
                src,
                onSubmit: (captcha: string) => {
                    unmountPopup(instance);
                    resolve(Promise.resolve(callback(captcha)).catch(() => false));
                },
                onClose: () => {
                    unmountPopup(instance);
                    resolve(false);
                }
            });
        });
    }
};
