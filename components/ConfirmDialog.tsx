import {Button, Dialog, Flex} from "@radix-ui/themes";
import type {ReactNode} from "react";

/** 다이얼로그 아래 버튼 줄 — 취소(닫기) 뒤에 children. cancelLabel이 null이면 취소 버튼 없음 */
export const DialogActions = ({cancelLabel = "취소", children}: { cancelLabel?: string | null; children?: ReactNode }) => (
    <Flex gap="3" justify="end" mt="4">
        {cancelLabel !== null && (
            <Dialog.Close>
                <Button variant="soft" color="gray">{cancelLabel}</Button>
            </Dialog.Close>
        )}
        {children}
    </Flex>
);

interface ConfirmDialogProps {
    title: string;
    confirmLabel?: string;
    /** null이면 취소 버튼 없음 (알림 전용) */
    cancelLabel?: string | null;
    danger?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/**
 * Themes Dialog 기반 confirm()/alert() 대체. 외부 클릭/Esc로 닫힘.
 * 열 때만 마운트한다 — 닫힘 애니메이션 동안 비워진 제목("null" 등)이 비치지 않게
 */
export const ConfirmDialog = ({
                                  title,
                                  confirmLabel = "확인",
                                  cancelLabel,
                                  danger,
                                  onConfirm,
                                  onClose
                              }: ConfirmDialogProps) => (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
        <Dialog.Content maxWidth="440px" aria-describedby={undefined}>
            <Dialog.Title>{title}</Dialog.Title>

            <DialogActions cancelLabel={cancelLabel}>
                <Button color={danger ? "red" : undefined} variant={danger ? "soft" : "solid"} onClick={onConfirm}>
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog.Content>
    </Dialog.Root>
);

/** 확인 버튼만 있는 알림. message가 없으면 그리지 않는다 */
export const Notice = ({message, onClose}: { message: string | null; onClose: () => void }) =>
    message ? <ConfirmDialog title={message} cancelLabel={null} onConfirm={onClose} onClose={onClose}/> : null;
