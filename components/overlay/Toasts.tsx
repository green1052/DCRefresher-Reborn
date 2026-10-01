import {Button, Card, Flex, IconButton, Text, VisuallyHidden} from "@radix-ui/themes";
import {CircleAlert, Info, TriangleAlert, X} from "lucide-react";
import {useEffect, useState} from "react";

import {type ToastData, useUiStore} from "@/stores/ui";

const TOAST_ICONS = {
    info: <Info size={16} color="var(--accent-11)"/>,
    warning: <TriangleAlert size={16} color="var(--amber-11)"/>,
    error: <CircleAlert size={16} color="var(--red-11)"/>
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
        <Card size="2" className="refresher-toast refresher-interactive">
            <Flex align="center" gap="3">
                {TOAST_ICONS[toast.type]}
                <Text size="2" style={{flex: 1}}>{toast.content}</Text>
                {toast.action && (
                    <Button size="1" variant="ghost" style={{flexShrink: 0}} onClick={() => {
                        dismiss();
                        toast.action?.run();
                    }}>
                        {toast.action.label}
                    </Button>
                )}
                <IconButton size="1" variant="ghost" color="gray" aria-label="닫기" onClick={dismiss}>
                    <X size={14}/>
                </IconButton>
            </Flex>
        </Card>
    );
};

/** 화면 아래의 토스트들 (useUiStore.showToast). */
export const ToastHost = () => {
    const toast = useUiStore((s) => s.toast);
    // 스크린 리더용 알림 칸은 늘 두고 글만 바꾼다. 토스트와 함께 새로 붙는 칸은 읽히지 않을 때가 많다.
    // 오버레이는 첫 토스트와 함께 붙으므로, 칸을 빈 채로 먼저 붙이고 다음 프레임부터 글을 넣어 첫 토스트도 읽히게 한다.
    // 글은 토스트마다 새 노드로 넣어 같은 알림이 이어져도 다시 읽힌다. 오류는 하던 말을 끊고 바로 읽는다(alert).
    const [announce, setAnnounce] = useState(false);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setAnnounce(true));
        return () => cancelAnimationFrame(frame);
    }, []);
    const spoken = announce ? toast : null;
    const error = spoken?.type === "error";
    return (
        <>
            <VisuallyHidden role="status">{spoken && !error && <span key={spoken.id}>{spoken.content}</span>}</VisuallyHidden>
            <VisuallyHidden role="alert">{spoken && error && <span key={spoken.id}>{spoken.content}</span>}</VisuallyHidden>
            {toast && <ToastItem key={toast.id} toast={toast}/>}
        </>
    );
};

