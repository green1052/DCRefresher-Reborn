import {Button, Dialog, Flex} from "@radix-ui/themes";
import type {ReactNode} from "react";

/** 다이얼로그 하단 버튼 줄. 취소(닫기) 버튼 뒤에 children을 둔다. cancelLabel이 null이면 취소 버튼을 뺀다 */
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
 * Themes Dialog로 만든 confirm()/alert() 대체. 바깥 클릭이나 Esc로 닫힌다.
 * 열 때만 마운트해야 닫힘 애니메이션 동안 비워진 제목("null" 등)이 비치지 않는다.
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
