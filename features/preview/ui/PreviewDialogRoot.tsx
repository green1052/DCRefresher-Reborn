import {Dialog} from "@base-ui/react/dialog";
import {type ReactNode, type RefObject, type WheelEventHandler, useRef} from "react";

import {overlay} from "@/components/overlay/shadow";
import {useUiStore} from "@/stores/ui";
import {MODAL_OVERLAY_SELECTOR} from "@/utils/event";
import {cn} from "cn";

import {usePreviewStore} from "./previewStore";

/** 미리보기 창의 뿌리 - 비모달 다이얼로그, Esc 정책, 바깥 누르기 닫기, 배경, 화면 전체 스크롤 칸. 내용은 children으로 Frame이 그린다. */
export const PreviewDialogRoot = ({fading, busy, blur, onWheel, scroller, children, after}: {
    fading: boolean;
    busy: boolean;
    blur: boolean;
    onWheel: WheelEventHandler;
    scroller: RefObject<HTMLDivElement | null>;
    children: ReactNode;
    after?: ReactNode;
}) => {
    // 창 안에서 글자를 끌어 고르다 바깥에서 놓거나 그 반대여도 click은 둘을 감싼 스크롤 칸에 떨어진다. 바깥에서 누르고 뗀 것만 닫는다.
    const pressedOutside = useRef(false);

    return (
        // 비모달 창이다. 스크롤 잠금과 PageUp/Down 이동은 직접 처리한다. 바깥 클릭 닫기는 아래 click이 맡는다(위에 뜬 팝업, 버블을 눌러도 닫히지 않게).
        <Dialog.Root
            open
            modal={false}
            disablePointerDismissal
            onOpenChange={(open, details) => {
                if (open) return;
                // 닫히는 동안(페이드)과 닫힌 뒤에도 잠시 Base UI가 Esc를 받는다. 이미 닫았으면 키를 흘려보내 목록의 Esc(선택 풀기)가 받게 한다.
                if (!usePreviewStore.getState().visible) {
                    details.cancel();
                    details.allowPropagation();
                    return;
                }
                // 버블은 여기서 닫는다 - Base UI는 Esc 리스너를 effect로 걸어 막 뜬 버블이 아직 Esc를 받지 못한다.
                if (details.reason === "escape-key" && useUiStore.getState().bubble) {
                    details.cancel();
                    useUiStore.getState().closeBubble();
                    return;
                }
                // 다이얼로그는 키를 흘려보내 그쪽이 닫히게 한다.
                if (details.reason === "escape-key" && overlay.portal?.querySelector(`${MODAL_OVERLAY_SELECTOR}, [data-slot=popover-content]`)) {
                    details.cancel();
                    details.allowPropagation();
                    return;
                }
                usePreviewStore.getState().requestClose();
            }}
        >
            <Dialog.Portal container={overlay.portal}>
                <div className={cn("fixed inset-0 bg-black/40 duration-150 animate-in fade-in data-fading:pointer-events-none data-fading:animate-out data-fading:fade-out data-fading:fill-mode-forwards",
                                   blur && "backdrop-blur-[5px]")}
                     data-fading={fading || undefined}/>
                {/* 화면 전체가 스크롤 칸 - 스크롤바 폭을 양쪽에 비워 글을 오갈 때 창이 흔들리지 않게 한다. */}
                <Dialog.Popup
                    className="refresher-frame-scroll fixed inset-0 flex overflow-y-auto overscroll-contain py-[5vh] outline-none duration-150 animate-in fade-in [scrollbar-color:var(--border)_transparent] [scrollbar-gutter:stable_both-edges] [scrollbar-width:thin] data-fading:pointer-events-none data-fading:animate-out data-fading:fade-out data-fading:fill-mode-forwards"
                    // Base UI가 Portal을 별도 커밋에 마운트해 [visible] effect가 돌 때는 아직 스크롤 칸이 없다(React). 붙는 순간 포커스한다.
                    ref={(element) => {
                        scroller.current = element;
                        element?.focus({preventScroll: true});
                    }}
                    tabIndex={-1}
                    data-fading={fading || undefined}
                    aria-busy={busy}
                    // 비모달이지만 연 동안 뒤 페이지를 inert로 막으므로 보조 기술에는 모달로 알린다.
                    aria-modal
                    // 포커스는 위 효과가 스크롤 칸에 주고, 닫을 때는 연 요소로 직접 돌려준다.
                    initialFocus={false}
                    finalFocus={false}
                    onWheel={onWheel}
                    // click/contextmenu에서 닫는다 - pointerdown에서 닫으면 이어지는 click이 아래 목록에 떨어진다.
                    onPointerDown={(ev) => (pressedOutside.current = ev.target === ev.currentTarget)}
                    onPointerUp={(ev) => (pressedOutside.current = pressedOutside.current && ev.target === ev.currentTarget)}
                    onClick={(ev) => {
                        if (pressedOutside.current && ev.target === ev.currentTarget) usePreviewStore.getState().requestClose();
                    }}
                    onContextMenu={(ev) => {
                        if (ev.target !== ev.currentTarget) return;
                        ev.preventDefault();
                        usePreviewStore.getState().requestClose();
                    }}
                >
                    {children}
                </Dialog.Popup>
                {after}
            </Dialog.Portal>
        </Dialog.Root>
    );
};
