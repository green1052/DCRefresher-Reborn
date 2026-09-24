import {useEffect} from "react";

import {MemoDialog} from "./MemoDialog";
import {PreviewHost} from "@/features/preview/ui/PreviewHost";
import {eventBus} from "@/core/eventbus/bus";
import {ISPData} from "@/utils/ip";
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

const COPY_FIELDS = [
    ["nick", "닉네임"],
    ["uid", "아이디"],
    ["ip", "IP"]
] as const;

const BubbleHost = () => {
    const bubble = useUiStore((s) => s.bubble);
    const selected = useUiStore((s) => s.selected);

    useEffect(() => {
        if (!bubble) return;

        const onKey = (event: KeyboardEvent): void => {
            if (event.key === "Escape") useUiStore.getState().closeBubble();
        };
        const onScroll = (): void => useUiStore.getState().closeBubble();
        const onMouseDown = (event: MouseEvent): void => {
            if (!(event.target instanceof Element) || !event.target.closest(".refresher-bubble")) {
                useUiStore.getState().closeBubble();
            }
        };

        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", onScroll, true);
        document.addEventListener("mousedown", onMouseDown);

        return () => {
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", onScroll, true);
            document.removeEventListener("mousedown", onMouseDown);
        };
    }, [bubble]);

    if (!bubble || !selected) return null;

    console.log("[refresher] 버블 렌더:", selected.nick, selected.uid, selected.ip, selected.dccon);

    const close = (): void => useUiStore.getState().closeBubble();
    const copy = (value: string): void => {
        close();
        void navigator.clipboard.writeText(value).then(() => useUiStore.getState().showToast("복사했습니다."));
    };

    if (selected.dccon) {
        return (
            <div className="refresher-bubble" style={{left: bubble.x + 8, top: bubble.y + 8}}>
                <div className="refresher-bubble-actions">
                    <button
                        type="button"
                        className="refresher-button refresher-primary"
                        onClick={() => {
                            eventBus.emit("refresherRequestBlock", {target: "dccon"});
                            close();
                        }}
                    >
                        디시콘 차단
                    </button>
                    <button
                        type="button"
                        className="refresher-button"
                        onClick={() => {
                            eventBus.emit("refresherRequestBlock", {target: "dccon", blockAllDccon: true});
                            close();
                        }}
                    >
                        디시콘 전체 차단
                    </button>
                </div>
            </div>
        );
    }

    const isp = selected.ip ? ISPData(selected.ip).name : undefined;

    return (
        <div className="refresher-bubble" style={{left: bubble.x + 8, top: bubble.y + 8}}>
            {COPY_FIELDS.map(([key, label]) =>
                selected[key] ? (
                    <div
                        key={key}
                        className="refresher-bubble-value"
                        style={{cursor: "pointer"}}
                        title="클릭하면 복사됩니다."
                        onClick={() => copy(selected[key]!)}
                    >
                        <span>
                            {label}: <strong>{selected[key]}</strong>
                        </span>
                    </div>
                ) : null
            )}
            {isp && (
                <div
                    className="refresher-bubble-value"
                    style={{cursor: "pointer"}}
                    title="클릭하면 복사됩니다."
                    onClick={() => copy(isp)}
                >
                    <span>
                        ISP: <strong>{isp}</strong>
                    </span>
                </div>
            )}

            <div className="refresher-bubble-actions">
                <button
                    type="button"
                    className="refresher-button refresher-primary"
                    onClick={() => {
                        eventBus.emit("refresherRequestBlock", {target: "user"});
                        close();
                    }}
                >
                    유저 차단
                </button>
                <button type="button" className="refresher-button" onClick={() => useUiStore.getState().openMemoForSelected()}>
                    메모
                </button>
                {selected.uid && (
                    <button
                        type="button"
                        className="refresher-button"
                        onClick={() => {
                            window.open(`https://gallog.dcinside.com/${selected.uid}`, "_blank");
                            close();
                        }}
                    >
                        갤로그
                    </button>
                )}
            </div>
        </div>
    );
};

const MemoHost = () => {
    const memo = useUiStore((s) => s.memo);
    if (!memo) return null;
    return <MemoDialog key={JSON.stringify(memo)} />;
};

export const ContentRoot = () => (
    <>
        <ToastHost />
        <BubbleHost />
        <MemoHost />
        <PreviewHost />
    </>
);
