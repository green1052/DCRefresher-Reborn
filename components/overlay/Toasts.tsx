import {CircleAlert, Info, TriangleAlert, X} from "lucide-react";
import {useEffect, useRef, useState, type ReactNode} from "react";

import {type ToastData, useUiStore} from "@/stores/ui";

// Base UI Toast 대신 필요한 최소한 - 화면에 3개까지, 시간이 지나면 저절로 닫힌다.
const LIMIT = 3;
let nextId = 1;

interface ManagedToast {
    id: number;
    title: string;
    level: ToastData["type"];
    autoClose: number;
    action?: ToastData["action"];
}

const TOAST_ICONS: Record<ToastData["type"], ReactNode> = {
    info: <Info className="size-4 shrink-0 text-link"/>,
    warning: <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400"/>,
    error: <CircleAlert className="size-4 shrink-0 text-destructive"/>
};

const ToastList = () => {
    const [toasts, setToasts] = useState<ManagedToast[]>([]);
    const timers = useRef(new Map<number, number>());

    const close = (id: number): void => {
        const timer = timers.current.get(id);
        if (timer !== undefined) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
        setToasts((list) => list.filter((toast) => toast.id !== id));
    };

    // showToast는 오버레이가 뜨기 전에도 불리니 스토어에 쌓아 Viewport가 붙은 뒤 effect로 넘긴다.
    const queued = useUiStore((s) => s.toasts);
    useEffect(() => {
        if (queued.length === 0) return;
        // 렌더 뒤 effect 전에 새로 쌓인 것은 남겨 두어 다음 effect에서 넘긴다.
        useUiStore.setState((s) => ({toasts: s.toasts.slice(queued.length)}));
        const added: ManagedToast[] = queued.map(({content, type, autoClose, action}) => ({
            id: nextId++,
            title: content,
            level: type,
            autoClose,
            action
        }));
        // 오류는 하던 말을 끊고 바로 읽는다(role=alert).
        const interrupting = added.some((toast) => toast.level === "error");
        setToasts((list) => [...added, ...(interrupting ? [] : list)].slice(0, LIMIT));
        for (const {id, autoClose} of added) {
            if (autoClose > 0) timers.current.set(id, window.setTimeout(() => close(id), autoClose));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queued]);

    useEffect(() => () => {
        for (const timer of timers.current.values()) clearTimeout(timer);
    }, []);

    return (
        // daisyUI .toast(우하단 고정, 자식 입장 애니메이션). 뷰포트는 클릭을 통과시키고 토스트만 받는다 - 다이얼로그 위에 둬 창이 떠 있어도 눌리게.
        <div role="region" aria-label="알림" aria-live="polite"
             className="toast pointer-events-none z-60 max-w-[360px] flex-col-reverse items-end">
            {toasts.map((toast) => (
                <div key={toast.id} data-slot="toast" role={toast.level === "error" ? "alert" : "status"}
                     className="pointer-events-auto flex max-w-[360px] items-center gap-3 rounded-xl bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10">
                    {TOAST_ICONS[toast.level]}
                    <p className="flex-1">{toast.title}</p>
                    {toast.action && (
                        <button type="button" className="btn btn-ghost btn-xs text-link" onClick={() => {
                            close(toast.id);
                            toast.action!.run();
                        }}>
                            {toast.action.label}
                        </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-square btn-xs" aria-label="닫기" onClick={() => close(toast.id)}>
                        <X className="size-3"/>
                    </button>
                </div>
            ))}
        </div>
    );
};

export const ToastHost = ToastList;
