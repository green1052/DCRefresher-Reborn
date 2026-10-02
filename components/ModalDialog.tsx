import {Dialog} from "@radix-ui/themes";
import type {ComponentProps, KeyboardEvent} from "react";

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

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]";

/**
 * Tab을 창 안에서 돌린다. Radix의 포커스 가두기는 document.activeElement로 끝을 알아보는데, 오버레이(shadow DOM) 안에서는
 * 그것이 늘 호스트라 끝을 못 알아보고 포커스가 디시 페이지로 나간다. 문서에 그린 창에서는 Radix가 먼저 막는다(defaultPrevented).
 */
const keepTabInside = (ev: KeyboardEvent<HTMLDivElement>): void => {
    if (ev.key !== "Tab" || ev.defaultPrevented) return;
    // 라디오 묶음(종류 고르기)의 고르지 않은 항목처럼 tabindex가 -1인 것은 Tab 순서에 없다.
    const items = [...ev.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((element) => element.tabIndex >= 0 && element.checkVisibility());
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;

    const active = (ev.currentTarget.getRootNode() as Document | ShadowRoot).activeElement;
    // 묶음(SegmentedControl 등의 roving focus)은 감싸는 요소가 tabindex를 갖고 포커스는 그 안의 항목에 있으므로 contains로 본다.
    if (ev.shiftKey ? first.contains(active) || active === ev.currentTarget : last.contains(active)) {
        ev.preventDefault();
        (ev.shiftKey ? last : first).focus();
    }
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
            <Dialog.Content {...content} onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={focus.onCloseAutoFocus} onKeyDown={keepTabInside}>
                {children}
            </Dialog.Content>
        </Dialog.Root>
    );
};
