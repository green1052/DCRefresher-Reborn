import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {useLayoutEffect, useRef, useState} from "react";

import UiService from "@/entrypoints/options/components/UiService";

import "@/components/toast.scss";
import "@/ui/service.scss";

type ToastLevel = "info" | "error" | "warning" | "cake";

type ToastClickHandler = (ev: MouseEvent) => void;

interface ToastExposed {
    show: (content: string, type: ToastLevel, autoClose: number, onClick?: ToastClickHandler) => void;
    hide: () => void;
    isOpen: () => boolean;
}

// 토스트 컴포넌트가 자신의 imperative API를 여기에 노출한다.
const toastApiHolder: { current: ToastExposed | null } = {current: null};

function Toast() {
    const [content, setContent] = useState("");
    const [clickCb, setClickCb] = useState<ToastClickHandler | null>(null);
    const [open, setOpen] = useState(false);
    const [type, setType] = useState<ToastLevel | null>(null);
    const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hide = () => {
        if (autoCloseTimer.current) {
            clearTimeout(autoCloseTimer.current);
            autoCloseTimer.current = null;
        }

        setOpen(false);
    };

    const show = (
        newContent: string,
        newType: ToastLevel,
        newAutoClose: number,
        clickHandler?: ToastClickHandler
    ) => {
        if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);

        setContent(newContent);
        setType(newType);
        setClickCb(clickHandler ?? null);

        if (newAutoClose > 0) {
            autoCloseTimer.current = setTimeout(hide, newAutoClose);
        } else {
            autoCloseTimer.current = null;
        }

        setOpen(true);
    };

    useLayoutEffect(() => {
        toastApiHolder.current = {
            show,
            hide,
            isOpen: () => open
        };
        return () => {
            toastApiHolder.current = null;
        };
    });

    return (
        <div
            className={clickCb ? "refresher-toast hover" : "refresher-toast"}
            data-type={type}
            style={{display: open ? undefined : "none"}}
            title={content}
        >
            <div
                className="contents"
                onClick={(ev) => clickCb?.(ev.nativeEvent)}
            >
                <div className="text">
                    <p>{content}</p>
                </div>
                <div
                    className="button"
                    onClick={hide}
                >
                    <i>X</i>
                </div>
            </div>
        </div>
    );
}

const div = document.createElement("div");
div.className = "refresher-toast-root";

type PendingToast = {
    content: string;
    type: ToastLevel;
    autoClose: number;
    onClick?: ToastClickHandler;
};

let instance: ToastExposed | null = null;
const pendingToasts: PendingToast[] = [];

const mountToast = () => {
    if (instance || !document.body) return;
    document.body.appendChild(div);

    const root = createRoot(div);
    flushSync(() => {
        root.render(
            <>
                <UiService/>
                <Toast/>
            </>
        );
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
