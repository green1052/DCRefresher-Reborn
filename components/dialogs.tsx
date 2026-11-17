import {AlertDialog as AlertDialogPrimitive} from "@base-ui/react/alert-dialog";
import {Dialog as DialogPrimitive} from "@base-ui/react/dialog";
import {X} from "lucide-react";
import {type KeyboardEvent, type ReactNode, type RefObject, useRef, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {useReturnFocus} from "@/components/useReturnFocus";
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogFooter, AlertDialogOverlay, AlertDialogTitle} from "@/components/ui/alert-dialog";
import {Button} from "@/components/ui/button";
import {Dialog, DialogClose, DialogFooter, DialogOverlay} from "@/components/ui/dialog";
import {useModuleSettings} from "@/core/module/useModuleSettings";
import {cn} from "cn";

// components/ui는 순정 유지 - Base UI 프리미티브로 조립, 모양 문자열은 ui와 수동 맞춤
const OverlayDialogContent = ({className, overlayProps, ...props}: DialogPrimitive.Popup.Props & {overlayProps?: DialogPrimitive.Backdrop.Props}) => (
    <DialogPrimitive.Portal data-slot="dialog-portal" container={overlay.portal}>
        <DialogOverlay {...overlayProps}/>
        <DialogPrimitive.Popup data-slot="dialog-content" className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl bg-popover p-6 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
        )} {...props}/>
    </DialogPrimitive.Portal>
);

const OverlayAlertDialogContent = ({className, overlayProps, ...props}: AlertDialogPrimitive.Popup.Props & {overlayProps?: AlertDialogPrimitive.Backdrop.Props}) => (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" container={overlay.portal}>
        <AlertDialogOverlay {...overlayProps}/>
        <AlertDialogPrimitive.Popup data-slot="alert-dialog-content" data-size="default" className={cn(
            "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl bg-popover p-6 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-[size=default]:max-w-xs data-[size=default]:sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
        )} {...props}/>
    </AlertDialogPrimitive.Portal>
);

type AutoFocus = "first" | "keyboard" | RefObject<HTMLElement | null>;

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]";

// Base UI 포커스 가두기는 shadow DOM 안의 끝을 못 알아 포커스가 디시 페이지로 나가므로 Tab을 직접 가둔다.
export const keepTabInside = (ev: KeyboardEvent<HTMLDivElement>): void => {
    if (ev.key !== "Tab" || ev.defaultPrevented) return;
    const items = [...ev.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((element) => element.tabIndex >= 0 && element.checkVisibility());
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;

    const active = (ev.currentTarget.getRootNode() as Document | ShadowRoot).activeElement;
    // 묶음은 감싸는 요소가 tabindex를 갖고 포커스는 그 안의 항목에 있으므로 contains로 본다.
    if (ev.shiftKey ? first.contains(active) || active === ev.currentTarget : last.contains(active)) {
        ev.preventDefault();
        (ev.shiftKey ? last : first).focus();
    }
};

const useModal = (onClose: () => void, focusOnOpen: AutoFocus) => {
    const [open, setOpen] = useState(true);
    const popup = useRef<HTMLDivElement>(null);
    const focus = useReturnFocus(popup);
    // 옵션 페이지에는 모듈 설정이 없어 기본(흐림)이다.
    const blur = useModuleSettings("preview")?.popupBlur ?? true;

    return {
        close: () => setOpen(false),
        root: {
            open,
            // 애니메이션이 끝났을 때 Base UI는 아직 포커스를 돌려주지 않았다(body). onClose가 알림 창을 띄우면 body를 연 요소로 기억하므로 먼저 돌려준다.
            onOpenChangeComplete: (next: boolean) => {
                if (next) return;
                focus.restoreFocus();
                onClose();
            }
        },
        popup: {
            ref: popup,
            onKeyDown: keepTabInside,
            // 겹친 창은 Base UI가 바깥 배경을 그리지 않으므로 늘 그린다 - isTyping, Esc 전달이 이 배경으로 창을 안다.
            overlayProps: {forceRender: true, className: blur ? undefined : "supports-backdrop-filter:backdrop-blur-none"},
            initialFocus: typeof focusOnOpen === "object" ? focusOnOpen : focusOnOpen === "first" || focus.keyboard,
            finalFocus: focus.finalFocus
        }
    };
};

// 닫힘 애니메이션과 포커스 반환 뒤에 onClose가 불린다 - 부모가 언마운트해 닫아도 된다.
export const ModalDialog = ({onClose, focusOnOpen = "first", dismissible = true, disablePointerDismissal, actionsRef, className, children}: {
    onClose: () => void;
    focusOnOpen?: AutoFocus;
    dismissible?: boolean;
    disablePointerDismissal?: boolean;
    actionsRef?: RefObject<DialogPrimitive.Root.Actions | null>;
    className?: string;
    children: ReactNode;
}) => {
    const modal = useModal(onClose, focusOnOpen);

    return (
        // actionsRef.close()는 dismissible과 상관없이 닫는다. 일이 끝난 직후라 dismissible이 아직 옛 값일 수 있다.
        <Dialog {...modal.root} actionsRef={actionsRef} disablePointerDismissal={disablePointerDismissal}
                onOpenChange={(next, {reason}) => !next && (dismissible || reason === "imperative-action") && modal.close()}>
            <OverlayDialogContent {...modal.popup} className={className}>
                {children}
            </OverlayDialogContent>
        </Dialog>
    );
};

export const DialogActions = ({cancelLabel = "취소", cancelDisabled, children}: { cancelLabel?: string | null; cancelDisabled?: boolean; children?: ReactNode }) => (
    <DialogFooter>
        {cancelLabel !== null && <DialogClose disabled={cancelDisabled} render={<Button variant="outline"/>}>{cancelLabel}</DialogClose>}
        {children}
    </DialogFooter>
);

/** 폼 제출이라 한글 조합 중 Enter로는 제출되지 않는다. */
export const SubmitForm = ({onSubmit, className, children}: { onSubmit: () => unknown; className?: string; children: ReactNode }) => (
    <form className={cn("flex flex-col gap-4", className)} onSubmit={(ev) => {
        ev.preventDefault();
        void onSubmit();
    }}>
        {children}
    </form>
);

export const DialogCloseButton = () => (
    <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label="닫기"/>}>
        <X/>
    </DialogClose>
);

// confirm()/alert() 대체 - 열 때만 마운트해야 닫힘 애니메이션 동안 빈 제목이 비치지 않는다.
export const ConfirmDialog = ({title, confirmLabel = "확인", cancelLabel = "취소", danger, onConfirm, onClose}: {
    title: string;
    confirmLabel?: string;
    cancelLabel?: string | null;
    danger?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) => {
    const modal = useModal(onClose, "first");

    return (
        <AlertDialog {...modal.root} onOpenChange={(next) => !next && modal.close()}>
            <OverlayAlertDialogContent {...modal.popup} className="text-sm data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-110">
                {/* 이미지 해시처럼 띄어쓰기 없는 긴 값도 창 안에서 줄을 바꾼다. */}
                <AlertDialogTitle className="text-sm leading-snug wrap-anywhere">{title}</AlertDialogTitle>
                <AlertDialogFooter>
                    {cancelLabel !== null && <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>}
                    <AlertDialogAction variant={danger ? "destructive" : "default"} onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
                </AlertDialogFooter>
            </OverlayAlertDialogContent>
        </AlertDialog>
    );
};

export const Notice = ({message, onClose}: { message: string | null; onClose: () => void }) =>
    message ? <ConfirmDialog title={message} cancelLabel={null} onConfirm={onClose} onClose={onClose}/> : null;
