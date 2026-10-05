import {CircleAlert, Info, TriangleAlert, X} from "lucide-react";
import {useEffect, useState} from "react";

import {Button} from "@/components/ui/button";
import {type ToastData, useUiStore} from "@/stores/ui";

const TOAST_ICONS = {
    info: <Info className="size-4 shrink-0 text-primary"/>,
    warning: <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400"/>,
    error: <CircleAlert className="size-4 shrink-0 text-destructive"/>
};

const ToastItem = ({toast}: { toast: ToastData }) => {
    useEffect(() => {
        if (toast.autoClose <= 0) return;
        const timer = setTimeout(() => useUiStore.getState().dismissToast(toast.id), toast.autoClose);
        return () => clearTimeout(timer);
    }, [toast]);

    const dismiss = (): void => useUiStore.getState().dismissToast(toast.id);

    // 읽어 주는 것은 ToastHost의 알림 칸이 맡는다. 여기에도 role을 달면 두 번 읽힌다.
    return (
        <div data-slot="toast" className="pointer-events-auto flex max-w-[360px] items-center gap-3 rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-200 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
            {TOAST_ICONS[toast.type]}
            <span className="flex-1">{toast.content}</span>
            {toast.action && (
                <Button size="xs" variant="ghost" className="text-primary" onClick={() => {
                    dismiss();
                    toast.action?.run();
                }}>
                    {toast.action.label}
                </Button>
            )}
            <Button size="icon-xs" variant="ghost" aria-label="닫기" onClick={dismiss}>
                <X/>
            </Button>
        </div>
    );
};

/** 화면 아래의 토스트들 (useUiStore.showToast). 여러 개가 아래에서 위로 쌓인다. */
export const ToastHost = () => {
    // 스크린 리더용 알림 칸은 늘 두고 글만 바꾼다. 토스트와 함께 새로 붙는 칸은 읽히지 않을 때가 많다.
    // 오버레이는 첫 토스트와 함께 붙으므로, 칸을 빈 채로 먼저 붙이고 다음 프레임부터 글을 넣어 첫 토스트도 읽히게 한다.
    // 글은 토스트마다 새 노드로 넣어 같은 알림이 이어져도 다시 읽힌다. 오류는 하던 말을 끊고 바로 읽는다(alert).
    const [announce, setAnnounce] = useState(false);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setAnnounce(true));
        return () => cancelAnimationFrame(frame);
    }, []);
    const toasts = useUiStore((s) => s.toasts);
    const spoken = announce ? toasts.at(-1) : undefined;
    const error = spoken?.type === "error";
    return (
        <>
            <span className="sr-only" role="status">{spoken && !error && <span key={spoken.id}>{spoken.content}</span>}</span>
            <span className="sr-only" role="alert">{spoken && error && <span key={spoken.id}>{spoken.content}</span>}</span>
            {toasts.length > 0 && (
                // 호스트는 클릭을 통과시키고 토스트만 받는다. 다이얼로그(z-50) 위에 두어 창이 떠 있을 때 뜬 알림도 보이고 눌린다.
                <div className="pointer-events-none fixed right-4 bottom-4 z-60 flex max-w-[360px] flex-col items-end gap-2">
                    {toasts.map((toast) => <ToastItem key={toast.id} toast={toast}/>)}
                </div>
            )}
        </>
    );
};
