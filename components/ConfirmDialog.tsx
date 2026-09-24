import {AlertDialog, Button, Flex} from "@radix-ui/themes";

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

/** Radix Themes AlertDialog 래퍼 — confirm()/alert() 대체 */
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
        <AlertDialog.Content style={{maxWidth: 440}}>
            <AlertDialog.Title>{title}</AlertDialog.Title>
            {description && <AlertDialog.Description size="2">{description}</AlertDialog.Description>}

            <Flex gap="3" justify="end" mt="4">
                {cancelLabel !== null && (
                    <AlertDialog.Cancel>
                        <Button variant="soft" color="gray">
                            {cancelLabel}
                        </Button>
                    </AlertDialog.Cancel>
                )}
                <AlertDialog.Action>
                    <Button color={danger ? "red" : undefined} variant={danger ? "soft" : "solid"} onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </AlertDialog.Action>
            </Flex>
        </AlertDialog.Content>
    </AlertDialog.Root>
);
