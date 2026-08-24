import {useLayoutEffect, useRef, useState} from "react";

import "./toast.scss";

export type ToastLevel = "info" | "error" | "warning" | "cake";

type ToastClickHandler = (ev: MouseEvent) => void;

export interface ToastExposed {
    show: (content: string, type: ToastLevel, autoClose: number, onClick?: ToastClickHandler) => void;
    hide: () => void;
    isOpen: () => boolean;
}

// utils/toast.ts가 가져가는 명령형 API 홀더
export const toastApiHolder: { current: ToastExposed | null } = {current: null};

export default function Toast() {
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
