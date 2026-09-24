import {useEffect} from "react";

import {MemoDialog} from "./MemoDialog";
import {PreviewHost} from "@/features/preview/ui/PreviewHost";
import {useUiStore, type ToastData} from "@/stores/ui";

const ToastItem = ({toast}: {toast: ToastData}) => {
    useEffect(() => {
        if (toast.autoClose <= 0) return;
        const timer = setTimeout(() => useUiStore.getState().dismissToast(toast.id), toast.autoClose);
        return () => clearTimeout(timer);
    }, [toast]);

    return (
        <div className={`refresher-toast refresher-toast-${toast.type}`} onClick={toast.onClick}>
            <span className="refresher-toast-content">{toast.content}</span>
            <button
                type="button"
                className="refresher-toast-close"
                onClick={(event) => {
                    event.stopPropagation();
                    useUiStore.getState().dismissToast(toast.id);
                }}
            >
                ×
            </button>
        </div>
    );
};

const ToastHost = () => {
    const toast = useUiStore((s) => s.toast);
    if (!toast) return null;
    return <ToastItem key={toast.id} toast={toast} />;
};

const MemoHost = () => {
    const memo = useUiStore((s) => s.memo);
    if (!memo) return null;
    return <MemoDialog key={JSON.stringify(memo)} />;
};

export const ContentRoot = () => (
    <>
        <ToastHost />
        <MemoHost />
        <PreviewHost />
    </>
);
