import {Dialog} from "@radix-ui/themes";
import type {ComponentProps} from "react";

import {useOpenerFocus} from "./useOpenerFocus";

/**
 * 연 창의 포커스.
 * - first: Radix 기본 (창의 첫 요소로 옮긴다).
 * - keyboard: 키보드로 열었을 때만 창 안으로 옮긴다. 마우스로 열었으면 그 자리에 둔다.
 * - none: 옮기지 않는다. 섀도 루트 안에서는 FocusScope가 입력칸의 autoFocus를 덮으므로, 입력칸이 스스로 포커스를 잡는 창에 쓴다.
 */
type AutoFocus = "first" | "keyboard" | "none";

type ModalDialogProps = Omit<ComponentProps<typeof Dialog.Content>, "onOpenAutoFocus" | "onCloseAutoFocus"> & {
    onClose: () => void;
    focusOnOpen?: AutoFocus;
};

/**
 * 열 때만 마운트하는 다이얼로그 (Radix Themes). Esc·바깥 클릭이 onClose를 부르고, 닫으면 연 요소로 포커스를 돌려준다 (useOpenerFocus).
 * 오버레이(shadow DOM) 안에서 띄우면 container에 overlay.portal을 넘긴다. 없으면 body에 그려 오버레이의 스타일이 닿지 않는다.
 */
export const ModalDialog = ({onClose, focusOnOpen = "first", children, ...content}: ModalDialogProps) => {
    const focus = useOpenerFocus();
    const onOpenAutoFocus = focusOnOpen === "keyboard" ? focus.onOpenAutoFocus : focusOnOpen === "none" ? (ev: Event) => ev.preventDefault() : undefined;

    return (
        <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
            <Dialog.Content {...content} onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={focus.onCloseAutoFocus}>
                {children}
            </Dialog.Content>
        </Dialog.Root>
    );
};
