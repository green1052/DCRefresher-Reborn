import {Button, Dialog, Flex, IconButton} from "@radix-ui/themes";
import {X} from "lucide-react";
import type {ReactNode} from "react";

import {ModalDialog} from "@/components/ModalDialog";

/** 다이얼로그 하단 버튼 줄. 취소(닫기) 버튼 뒤에 children을 둔다. cancelLabel이 null이면 취소 버튼을 뺀다. */
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

/** Enter로 저장하는 다이얼로그 폼. 폼 제출이라 한글 조합을 끝내는 Enter로는 브라우저가 제출하지 않는다. */
export const SubmitForm = ({onSubmit, children}: { onSubmit: () => unknown; children: ReactNode }) => (
    <form onSubmit={(ev) => {
        ev.preventDefault();
        void onSubmit();
    }}>
        {children}
    </form>
);

/** 제목 줄 오른쪽 닫기(X) 버튼. 아래 버튼 줄 없이 보기만 하거나 고르면 바로 닫히는 창(디시콘 정보·선택)에 둔다. */
export const DialogCloseButton = () => (
    <Dialog.Close>
        <IconButton size="1" variant="ghost" color="gray" aria-label="닫기"><X size={16}/></IconButton>
    </Dialog.Close>
);

interface ConfirmDialogProps {
    title: string;
    confirmLabel?: string;
    /** null이면 취소 버튼 없음 (알림 전용). */
    cancelLabel?: string | null;
    danger?: boolean;
    /** 오버레이(shadow DOM) 안에서 띄울 때 overlay.portal. 없으면 body에 그려 오버레이의 스타일이 닿지 않는다. */
    container?: HTMLElement;
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
                                  container,
                                  onConfirm,
                                  onClose
                              }: ConfirmDialogProps) => {
    return (
        <ModalDialog onClose={onClose} container={container} maxWidth="440px" aria-describedby={undefined}>
                <Dialog.Title>{title}</Dialog.Title>

                <DialogActions cancelLabel={cancelLabel}>
                    <Button color={danger ? "red" : undefined} variant={danger ? "soft" : "solid"} onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </DialogActions>
        </ModalDialog>
    );
};

/** 확인 버튼만 있는 알림. message가 없으면 그리지 않는다. */
export const Notice = ({message, onClose}: { message: string | null; onClose: () => void }) =>
    message ? <ConfirmDialog title={message} cancelLabel={null} onConfirm={onClose} onClose={onClose}/> : null;
