import {type ComponentPublicInstance, createApp} from "vue";

import Toast from "../components/toast.vue";

const div = document.createElement("div");
div.className = "refresher-toast";

let instance: ComponentPublicInstance | null = null;

document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(div);
    instance = createApp(Toast).mount(div);
});

window.addEventListener("keydown", (ev) => {
    if (instance?.open && ev.key === "Escape") instance.hide();
});

export const show = (
    content: string,
    type: "info" | "error" | "warning" | "cake" = "info",
    autoClose: number = 5000,
    onClick?: (ev: MouseEvent) => void
): void => {
    if (!instance) throw new Error("Toast instance is not initialized");

    instance.show(content, type, autoClose, onClick);
};

export default {
    show
};