import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";

import Toast, {type ToastLevel, toastApiHolder} from "@/components/toast";

const div = document.createElement("div");
div.className = "refresher-toast";

type ToastClickHandler = (ev: MouseEvent) => void;
type PendingToast = {
    content: string;
    type: ToastLevel;
    autoClose: number;
    onClick?: ToastClickHandler;
};

let instance: { show: (content: string, type: ToastLevel, autoClose: number, onClick?: ToastClickHandler) => void; hide: () => void; isOpen: () => boolean } | null = null;
const pendingToasts: PendingToast[] = [];

const mountToast = () => {
    if (instance || !document.body) return;
    document.body.appendChild(div);

    const root = createRoot(div);
    flushSync(() => {
        root.render(<Toast/>);
    });

    instance = toastApiHolder.current;

    for (const toast of pendingToasts.splice(0, pendingToasts.length)) {
        instance?.show(toast.content, toast.type, toast.autoClose, toast.onClick);
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

const show = (
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
