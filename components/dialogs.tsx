import {X} from "lucide-preact";
import { useContext, useId, useLayoutEffect, useRef } from "preact/hooks";
import { createContext, type ComponentProps, type TargetedKeyboardEvent as KeyboardEvent, type ComponentChild as ReactNode, type RefObject } from "preact";

import {useReturnFocus} from "@/components/useReturnFocus";
import {useModuleSettings} from "@/core/module/useModuleSettings";
import {cn} from "cn";

type AutoFocus = "first" | "keyboard" | RefObject<HTMLElement | null>;

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]";

const firstFocusable = (root: ParentNode): HTMLElement | null => {
    const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((element) => element.tabIndex >= 0 && element.checkVisibility());
    return items[0] ?? null;
};

export {firstFocusable};

// native <dialog>의 Tab 가두기는 Chromium에서 창 요소를 거치는 빈 돌점에 포커스가 shadow 밖(body)으로 샌다 - 가장자리에서 직접 돈다.
export const keepTabInside = (ev: KeyboardEvent<HTMLElement>): void => {
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

const DialogCloseContext = createContext<() => void>(() => {});

// native <dialog>은 제목을 이름으로 붙이지 않으므로 ModalDialog가-labelledby로 직접 잇는다.
const DialogTitleContext = createContext<string | null>(null);

/** 모달 창 안에서 닫는 단추. 누르면 먼저 손님 onClick을 부르고 닫힘 애니메이션을 시작한다. */
export const DialogClose = ({onClick, ...props}: Omit<ComponentProps<"button">, "onClick"> & {onClick?: () => void}) => {
    const close = useContext(DialogCloseContext);
    return <button type="button" {...props} onClick={() => {
        onClick?.();
        close();
    }}/>;
};

// native <dialog class="modal">+showModal - top-layer, ::backdrop, Tab 가두기, Esc(cancel), 열림/닫힘 전환을 daisyUI .modal이 맡는다.
export const ModalDialog = ({onClose, focusOnOpen = "first", dismissible = true, disablePointerDismissal, actionsRef, contentSlot = "dialog-content", role, className, children}: {
    onClose: () => void;
    focusOnOpen?: AutoFocus;
    dismissible?: boolean;
    disablePointerDismissal?: boolean;
    actionsRef?: RefObject<{close: () => void} | null>;
    /** e2e 계약: 확인 창(alert)은 dialog-content가 아니라 alert-dialog-content로 찾는다. */
    contentSlot?: string;
    /** 확인 창처럼 대답을 요구하는 창은 alertdialog 역할을 건다(e2e 계약). */
    role?: "alertdialog";
    className?: string;
    children: ReactNode;
}) => {
    const dialog = useRef<HTMLDialogElement>(null);
    const focus = useReturnFocus(dialog);
    const titleId = useId();
    // 옵션 페이지에는 모듈 설정이 없어 기본(흐림)이다.
    const blur = useModuleSettings("preview")?.popupBlur ?? true;

    // actionsRef.close()는 dismissible과 상관없이 닫는다. 일이 끝난 직후라 dismissible이 아직 옛 값일 수 있다.
    const close = () => {
        const el = dialog.current;
        if (!el?.open) return;
        // onClose가 알림 창을 띄우면 body를 연 요소로 기억하므로 먼저 돌려준다.
        el.close();
        focus.restoreFocus();
        // 닫힘 전환을 기다렸다 닫으면 그 사이에 다시 연 창을 옛 타이머가 지우므로 즉시 닫는다(열림 전환만 daisyUI가 맡는다).
        onClose();
    };
    useLayoutEffect(() => {
        if (actionsRef) actionsRef.current = {close};
    });

    useLayoutEffect(() => {
        const el = dialog.current!;
        el.showModal();
        // 마우스로 열었으면 브라우저가 dialog 요소에 둔 포커스를 그대로 둔다(모달이라 안으로는 들어온다).
        if (typeof focusOnOpen === "object") focusOnOpen.current?.focus();
        else if (focusOnOpen === "first" || (focusOnOpen === "keyboard" && focus.keyboard)) firstFocusable(el)?.focus();
    }, []);

    return (
        <DialogTitleContext.Provider value={titleId}>
            <DialogCloseContext.Provider value={close}>
                <dialog
                    ref={dialog}
                    className="modal"
                    data-slot="dialog-overlay"
                    data-blur={blur ? "" : undefined}
                    aria-labelledby={titleId}
                    role={role}
                    onCancel={(ev) => {
                        // Esc의 기본 닫기는 전환을 기다리지 않으므로 막고 직접 닫는다.
                        ev.preventDefault();
                        if (dismissible) close();
                    }}
                    onClick={(ev) => {
                        // ::backdrop 누름은 dialog 요소로 전달된다.
                        if (ev.target === ev.currentTarget && dismissible && !disablePointerDismissal) close();
                    }}
                >
                    <div
                        data-slot={contentSlot}
                        className={cn("modal-box relative grid gap-6 bg-base-100 text-sm ring-1 ring-base-content/10 outline-none", className)}
                        // Chromium의 모달 Tab 순환은 창 요소를 거치는 빈 돌점에서 포커스가 shadow 밖(body)으로 샌다 - 가장자리에서 직접 돈다.
                        onKeyDown={keepTabInside}
                    >
                        {children}
                    </div>
                </dialog>
            </DialogCloseContext.Provider>
        </DialogTitleContext.Provider>
    );
};

export const DialogActions = ({cancelLabel = "취소", cancelDisabled, children}: { cancelLabel?: string | null; cancelDisabled?: boolean; children?: ReactNode }) => (
    <DialogFooter>
        {cancelLabel !== null && <DialogClose className="btn btn-outline" disabled={cancelDisabled}>{cancelLabel}</DialogClose>}
        {children}
    </DialogFooter>
);

export const DialogHeader = ({className, ...props}: ComponentProps<"div">) => (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props}/>
);

export const DialogFooter = ({className, ...props}: ComponentProps<"div">) => (
    <div data-slot="dialog-footer" className={cn("modal-action", className)} {...props}/>
);

export const DialogTitle = ({className, ...props}: ComponentProps<"h2">) => {
    const titleId = useContext(DialogTitleContext);
    return <h2 data-slot="dialog-title" id={titleId ?? undefined} className={cn("leading-none font-medium", className)} {...props}/>;
};

export const DialogDescription = ({className, ...props}: ComponentProps<"p">) => (
    <p data-slot="dialog-description" className={cn("text-sm text-base-content/60 *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-base-content", className)} {...props}/>
);

export const DialogCloseButton = () => (
    <DialogClose className="btn btn-ghost btn-square btn-sm absolute top-4 right-4" aria-label="닫기">
        <X className="size-4"/>
    </DialogClose>
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

// confirm()/alert() 대체 - 열 때만 마운트해야 닫힘 애니메이션 동안 빈 제목이 비치지 않는다.
export const ConfirmDialog = ({title, confirmLabel = "확인", cancelLabel = "취소", danger, onConfirm, onClose}: {
    title: string;
    confirmLabel?: string;
    cancelLabel?: string | null;
    danger?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) => (
    <ModalDialog onClose={onClose} className="sm:max-w-110" contentSlot="alert-dialog-content" role="alertdialog">
        {/* 이미지 해시처럼 띄어쓰기 없는 긴 값도 창 안에서 줄을 바꾼다. */}
        <DialogTitle className="text-sm leading-snug wrap-anywhere">{title}</DialogTitle>
        <DialogFooter>
            {cancelLabel !== null && <DialogClose className="btn btn-outline">{cancelLabel}</DialogClose>}
            <DialogClose className={cn("btn", danger ? "btn-error" : "btn-primary")} onClick={onConfirm}>{confirmLabel}</DialogClose>
        </DialogFooter>
    </ModalDialog>
);

export const Notice = ({message, onClose}: { message: string | null; onClose: () => void }) =>
    message ? <ConfirmDialog title={message} cancelLabel={null} onConfirm={onClose} onClose={onClose}/> : null;
