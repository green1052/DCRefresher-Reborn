import {Toast} from "@base-ui/react/toast";
import {CircleAlert, Info, TriangleAlert, X} from "lucide-react";
import {useEffect} from "react";

import {Button} from "@/components/ui/button";
import {type ToastData, useUiStore} from "@/stores/ui";

const TOAST_ICONS = {
    info: <Info className="size-4 shrink-0 text-link"/>,
    warning: <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400"/>,
    error: <CircleAlert className="size-4 shrink-0 text-destructive"/>
};

const ToastList = () => {
    const {toasts, add, close} = Toast.useToastManager<{ level: ToastData["type"] }>();
    // showToast는 오버레이가 뜨기 전에도 불리므로 스토어에 쌓아 두고 여기서 넘긴다.
    // effect는 알림 칸(Viewport)이 붙은 뒤에 돌므로 오버레이와 함께 뜬 첫 토스트도 읽힌다.
    const queued = useUiStore((s) => s.toasts);
    useEffect(() => {
        if (queued.length === 0) return;
        // 렌더 뒤 effect 전에 새로 쌓인 것은 남겨 두어 다음 effect에서 넘긴다.
        useUiStore.setState((s) => ({toasts: s.toasts.slice(queued.length)}));
        for (const {content, type, autoClose, action} of queued) {
            const id = add({
                title: content,
                timeout: autoClose,
                // 오류는 하던 말을 끊고 바로 읽는다 (Viewport가 role=alert로 따로 읽는다).
                priority: type === "error" ? "high" : "low",
                data: {level: type},
                actionProps: action && {
                    children: action.label,
                    onClick: () => {
                        close(id);
                        action.run();
                    }
                }
            });
        }
    }, [queued, add, close]);

    return (
        // 뷰포트는 클릭을 통과시키고 토스트만 받는다. 다이얼로그(z-50) 위에 두어 창이 떠 있을 때 뜬 알림도 보이고 눌린다.
        // 최신 토스트가 맨 앞이라 아래에서 위로 쌓이게 뒤집는다. 3개를 넘은 오래된 것은 Base UI가 data-limited를 달아 숨긴다.
        <Toast.Viewport aria-label="알림" className="pointer-events-none fixed right-4 bottom-4 z-60 flex max-w-[360px] flex-col-reverse items-end gap-2">
            {toasts.map((toast) => (
                <Toast.Root key={toast.id} toast={toast} data-slot="toast" className="pointer-events-auto flex max-w-[360px] items-center gap-3 rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-200 animate-in fade-in slide-in-from-bottom-2 data-limited:hidden motion-reduce:animate-none">
                    {toast.data && TOAST_ICONS[toast.data.level]}
                    <Toast.Title className="flex-1"/>
                    <Toast.Action render={<Button size="xs" variant="ghost" className="text-link"/>}/>
                    <Toast.Close render={<Button size="icon-xs" variant="ghost" aria-label="닫기"/>}>
                        <X/>
                    </Toast.Close>
                </Toast.Root>
            ))}
        </Toast.Viewport>
    );
};

/** 화면 아래의 토스트들 (useUiStore.showToast). 마우스를 올리거나 포커스하면 닫히는 시간이 멈춘다 (Base UI Toast). */
export const ToastHost = () => (
    <Toast.Provider limit={3}>
        <ToastList/>
    </Toast.Provider>
);
