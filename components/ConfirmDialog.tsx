import {AlertDialog} from "radix-ui";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    /** null이면 취소 버튼 없음 (알림 전용) */
    cancelLabel?: string | null;
    danger?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/** Radix AlertDialog 래퍼 — confirm()/alert() 대체 */
export const ConfirmDialog = ({
    open,
    title,
    description,
    confirmLabel = "확인",
    cancelLabel = "취소",
    danger,
    onConfirm,
    onClose
}: ConfirmDialogProps) => (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <AlertDialog.Portal>
            <AlertDialog.Overlay className="refresher-overlay" />
            <AlertDialog.Content className="refresher-dialog">
                <AlertDialog.Title className="refresher-dialog-title">{title}</AlertDialog.Title>
                {description && <AlertDialog.Description className="refresher-dialog-desc">{description}</AlertDialog.Description>}

                <div className="refresher-dialog-actions">
                    {cancelLabel !== null && (
                        <AlertDialog.Cancel className="refresher-button">{cancelLabel}</AlertDialog.Cancel>
                    )}
                    <AlertDialog.Action
                        className={`refresher-button ${danger ? "refresher-danger" : "refresher-primary"}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </AlertDialog.Action>
                </div>
            </AlertDialog.Content>
        </AlertDialog.Portal>
    </AlertDialog.Root>
);
