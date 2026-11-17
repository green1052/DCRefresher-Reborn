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

/**
 * 오버레이(shadow DOM) 안의 포털 칸에 그리는 창 몸통. components/ui의 dialog, alert-dialog는 순정 shadcn이라 포털 칸을 못 바꾸므로
 * Base UI 프리미티브로 직접 조립한다(ImageViewer, Frame과 같은 방식). 모양 문자열은 components/ui와 맞춘다.
 * 옵션, 팝업에서는 overlay.portal이 비어 body에 그린다(순정과 같은 행동). 배경은 forceRender로 늘 그려 단축키 막기(isTyping)가 알게 한다.
 */
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

/**
 * 연 창의 포커스.
 * - first: 창의 첫 요소로 옮긴다.
 * - keyboard: 키보드로 열었을 때만 창 안으로 옮긴다. 마우스로 열었으면 그 자리에 둔다.
 * - ref: 그 요소(입력칸 등)로 옮긴다. 입력칸부터 쓰는 창은 이것으로 첫 포커스를 정한다.
 */
type AutoFocus = "first" | "keyboard" | RefObject<HTMLElement | null>;

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]";

/**
 * Tab을 창 안에서 돌린다. Base UI의 포커스 가두기는 문서의 activeElement로 끝을 알아보는데, 오버레이(shadow DOM) 안에서는
 * 그것이 늘 호스트라 끝을 못 알아보고 포커스가 디시 페이지로 나간다. 문서에 그린 창에서는 Base UI가 먼저 막는다(defaultPrevented).
 */
export const keepTabInside = (ev: KeyboardEvent<HTMLDivElement>): void => {
    if (ev.key !== "Tab" || ev.defaultPrevented) return;
    // 묶음(토글 묶음 등)의 고르지 않은 항목처럼 tabindex가 -1인 것은 Tab 순서에 없다.
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

/** 열 때만 마운트하는 창(ModalDialog, ConfirmDialog)의 열림 상태와 Root, Popup에 넘길 포커스, 배경 흐림. */
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
            // 미리보기 안에서 연 창(디시콘, 확인 창 등)은 Base UI가 겹친 창으로 보고 바깥 배경을 그리지 않으므로 늘 그린다.
            // 단축키 막기(isTyping)와 미리보기의 Esc 전달이 이 배경으로 창이 떠 있는지 안다. 흐리지 않을 때는 흐림만 뺀다.
            overlayProps: {forceRender: true, className: blur ? undefined : "supports-backdrop-filter:backdrop-blur-none"},
            initialFocus: typeof focusOnOpen === "object" ? focusOnOpen : focusOnOpen === "first" || focus.keyboard,
            finalFocus: focus.finalFocus
        }
    };
};

/**
 * 열 때만 마운트하는 다이얼로그. Esc, 바깥 클릭, 닫기 버튼이 닫고, 닫으면 연 요소로 포커스를 돌려준다.
 * onClose는 닫힘 애니메이션이 끝나 포커스가 돌아간 뒤에 불린다. 그 안에서 알림 창을 띄워도 알림이 닫히면 연 요소로 돌아온다.
 * 부모가 언마운트해 닫아도 된다 (저장한 뒤 등). dismissible이 false면(가져오는 중 등) 닫지 않는다.
 * 오버레이(shadow DOM)에서는 그 안의 포털 칸에 그린다 (OverlayDialogContent). 폭은 className으로 준다 (sm:max-w-[480px] 등).
 */
export const ModalDialog = ({onClose, focusOnOpen = "first", dismissible = true, disablePointerDismissal, actionsRef, className, children}: {
    onClose: () => void;
    focusOnOpen?: AutoFocus;
    dismissible?: boolean;
    /** 바깥 클릭으로 닫지 않는다 (Esc로는 닫힌다). 창 밖에 뜬 버블을 누를 때 등. */
    disablePointerDismissal?: boolean;
    /** 창 안의 일이 끝나 스스로 닫을 때 쓴다 (actionsRef.current.close()). 닫기 애니메이션, 포커스 돌려주기를 거친다. */
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

/**
 * 다이얼로그 하단 버튼 줄. 취소(닫기) 버튼 뒤에 children을 둔다. cancelLabel이 null이면 취소 버튼을 뺀다.
 * cancelDisabled는 닫지 못하는 동안(ModalDialog의 dismissible이 false) 취소 버튼도 꺼 둔다.
 */
export const DialogActions = ({cancelLabel = "취소", cancelDisabled, children}: { cancelLabel?: string | null; cancelDisabled?: boolean; children?: ReactNode }) => (
    <DialogFooter>
        {cancelLabel !== null && <DialogClose disabled={cancelDisabled} render={<Button variant="outline"/>}>{cancelLabel}</DialogClose>}
        {children}
    </DialogFooter>
);

/** Enter로 저장하는 다이얼로그 폼. 폼 제출이라 한글 조합을 끝내는 Enter로는 브라우저가 제출하지 않는다. */
export const SubmitForm = ({onSubmit, className, children}: { onSubmit: () => unknown; className?: string; children: ReactNode }) => (
    <form className={cn("flex flex-col gap-4", className)} onSubmit={(ev) => {
        ev.preventDefault();
        void onSubmit();
    }}>
        {children}
    </form>
);

/** 제목 줄 오른쪽 닫기(X) 버튼. 아래 버튼 줄 없이 보기만 하거나 고르면 바로 닫히는 창(디시콘 정보, 선택)에 둔다. */
export const DialogCloseButton = () => (
    <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label="닫기"/>}>
        <X/>
    </DialogClose>
);

/**
 * confirm()/alert() 대체. role이 alertdialog라 바깥 클릭으로는 닫히지 않고 Esc나 버튼으로 닫힌다.
 * 열 때만 마운트해야 닫힘 애니메이션 동안 비워진 제목("null" 등)이 비치지 않는다.
 */
export const ConfirmDialog = ({title, confirmLabel = "확인", cancelLabel = "취소", danger, onConfirm, onClose}: {
    title: string;
    confirmLabel?: string;
    /** null이면 취소 버튼 없음 (알림 전용). */
    cancelLabel?: string | null;
    danger?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) => {
    const modal = useModal(onClose, "first");

    return (
        <AlertDialog {...modal.root} onOpenChange={(next) => !next && modal.close()}>
            {/* 생김새는 다른 창(DialogContent, DialogTitle)과 맞춘다. */}
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

/** 확인 버튼만 있는 알림. message가 없으면 그리지 않는다. */
export const Notice = ({message, onClose}: { message: string | null; onClose: () => void }) =>
    message ? <ConfirmDialog title={message} cancelLabel={null} onConfirm={onClose} onClose={onClose}/> : null;
