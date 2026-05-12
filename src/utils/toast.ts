import {createApp} from "vue";

import Toast, {type ToastLevel} from "../components/toast.vue";

const div = document.createElement("div");
div.className = "refresher-toast";

type ToastClickHandler = (ev: MouseEvent) => void;
type PendingToast = {
    content: string;
    type: ToastLevel;
    autoClose: number;
    onClick?: ToastClickHandler;
};

type ToastExposed = {
    show: (content: string, type: ToastLevel, autoClose: number, onClick?: ToastClickHandler) => void;
    hide: () => void;
    isOpen: () => boolean;
};

let instance: ToastExposed | null = null;
const pendingToasts: PendingToast[] = [];

const mountToast = () => {
    if (instance || !document.body) return;
    document.body.appendChild(div);
    instance = createApp(Toast).mount(div) as unknown as ToastExposed;

    for (const toast of pendingToasts.splice(0, pendingToasts.length)) {
        instance.show(toast.content, toast.type, toast.autoClose, toast.onClick);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    mountToast();
});

window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && instance?.isOpen()) {
        instance.hide();
    }
});

export const show = (
    content: string,
    type: ToastLevel = "info",
    autoClose: number = 5000,
    onClick?: ToastClickHandler
): void => {
    mountToast();
    if (!instance) {
        pendingToasts.push({
            content,
            type,
            autoClose,
            onClick
        });
        return;
    }

    instance.show(content, type, autoClose, onClick);
};

export default {
    show
};
