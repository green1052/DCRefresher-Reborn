import {Button, Dialog, Flex} from "@radix-ui/themes";

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

/** Themes Dialog 기반 confirm()/alert() 대체. 외부 클릭/Esc로 닫힘 */
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
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <Dialog.Content style={{maxWidth: 440}}>
            <Dialog.Title>{title}</Dialog.Title>
            {description && (
                <Dialog.Description size="2">{description}</Dialog.Description>
            )}

            <Flex gap="3" justify="end" mt="4">
                {cancelLabel !== null && (
                    <Dialog.Close>
                        <Button variant="soft" color="gray">
                            {cancelLabel}
                        </Button>
                    </Dialog.Close>
                )}
                <Button color={danger ? "red" : undefined} variant={danger ? "soft" : "solid"} onClick={onConfirm}>
                    {confirmLabel}
                </Button>
            </Flex>
        </Dialog.Content>
    </Dialog.Root>
);
