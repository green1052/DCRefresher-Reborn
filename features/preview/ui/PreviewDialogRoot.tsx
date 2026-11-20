import { createPortal } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { type ComponentChild as ReactNode, type RefObject, type WheelEventHandler } from "preact";

import {overlay} from "@/components/overlay/shadow";
import {useUiStore} from "@/stores/ui";
import {cn} from "cn";

import {usePreviewStore} from "./previewStore";

/** 미리보기 창의 뿌리 - 비모달 창, Esc 정책, 바깥 누르기 닫기, 배경, 화면 전체 스크롤 칸. 내용은 children으로 Frame이 그린다. */
export const PreviewDialogRoot = ({fading, busy, blur, onWheel, scroller, children, after}: {
    fading: boolean;
    busy: boolean;
    blur: boolean;
    onWheel: WheelEventHandler<HTMLElement>;
    scroller: RefObject<HTMLDivElement | null>;
    children: ReactNode;
    after?: ReactNode;
}) => {
    // 창 안에서 글자를 끌어 고르다 바깥에서 놓거나 그 반대여도 click은 둘을 감싼 스크롤 칸에 떨어진다. 바깥에서 누르고 뗀 것만 닫는다.
    const pressedOutside = useRef(false);

    // Esc는 위에 뜬 것부터 닫는다. capture로 페이지의 Esc(목록 선택 풀기)보다 먼저 받는다.
    useEffect(() => {
        const onKey = (ev: KeyboardEvent): void => {
            if (ev.key !== "Escape") return;
            // 닫히는 동안(페이드)과 닫힌 뒤에는 키를 흘려보내 목록의 Esc(선택 풀기)가 받게 한다.
            if (!usePreviewStore.getState().visible) return;
            // 버블은 여기서만 닫는다 - native 모달 창이 함께 닫히지 않게 막는다.
            if (useUiStore.getState().bubble) {
                ev.preventDefault();
                ev.stopPropagation();
                useUiStore.getState().closeBubble();
                return;
            }
            // native 모달(디시콘 정보, 이미지 크게 보기)이 떠 있으면 브라우저가 그 창을 닫는다.
            // 메모 창은 overlay.portal 밖 shadow 트리에도 열리므로 이벤트 경로로도 찾는다.
            if (overlay.portal?.querySelector("dialog[open], [data-slot=popover-content]")) return;
            if (ev.composedPath().some((node) => node instanceof HTMLDialogElement && node.open)) return;
            ev.stopPropagation();
            usePreviewStore.getState().requestClose();
        };
        window.addEventListener("keydown", onKey, {capture: true});
        return () => window.removeEventListener("keydown", onKey, {capture: true});
    }, []);

    // 비모달이지만 연 동안 뒤 페이지를 inert로 잠가 보조 기술에는 모달로 보이게 한다(Base UI가 하던 것). 언마운트될 때 푼다.
    // 오버레이가 그려진 shadow host(태그 refresher-root, entrypoints/content.tsx)와
    // 스텔스 이미지 보이기 버튼처럼 미리보기 위에 남을 조작부(stealth/index.ts의 data-refresher-ui)는 잠그면 안 된다.
    useEffect(() => {
        const locked: Element[] = [];
        for (const element of document.body.children) {
            if (element.matches("refresher-root, [data-refresher-ui]")) continue;
            if (!element.hasAttribute("inert")) {
                element.setAttribute("inert", "");
                locked.push(element);
            }
        }
        return () => {
            for (const element of locked) element.removeAttribute("inert");
        };
    }, []);

    const content = (
        <>
            {/* useScrollLock이 페이지 스크롤바 칸까지 회수하므로 fixed 배경이 창 끝까지 닿는다(남겨 두면 fixed는 그 칸에 그려지지 않는다). */}
            <div className={cn("fixed inset-y-0 left-0 w-screen bg-black/40 duration-150 animate-in fade-in data-fading:pointer-events-none data-fading:animate-out data-fading:fade-out data-fading:fill-mode-forwards",
                               blur && "backdrop-blur-[5px]")}
                 data-fading={fading || undefined}/>
            {/* 화면 전체가 스크롤 칸 - 스크롤바 폭을 양쪽에 비워 글을 오갈 때 창이 흔들리지 않게 한다. */}
            <div
                className="refresher-frame-scroll fixed inset-y-0 left-0 w-screen flex overflow-y-auto overscroll-contain py-[5vh] outline-none duration-150 animate-in fade-in [scrollbar-color:color-mix(in_oklab,var(--color-base-content)_25%,transparent)_var(--color-base-100)] [scrollbar-gutter:stable_both-edges] [scrollbar-width:auto] data-fading:pointer-events-none data-fading:animate-out data-fading:fade-out data-fading:fill-mode-forwards"
                ref={(element) => {
                    scroller.current = element;
                    element?.focus({preventScroll: true});
                }}
                tabIndex={-1}
                data-fading={fading || undefined}
                aria-busy={busy}
                // 뒤 페이지를 inert로 막으므로 보조 기술에는 모달로 알린다.
                role="dialog"
                aria-modal="true"
                onWheel={(ev) => {
                    // 스킵 제스처는 이 칸의 스크롤 위치로 판단하는데, 위에 뜬 native 모달(디시콘 팝업 등)이 이 칸의 DOM 자손이라
                    // 휠이 버블링으로 올라온다(top-layer는 겹치는 순서일 뿐). 모달 안의 휠은 제스처에 안 넘긴다.
                    if (ev.composedPath().some((node) => node instanceof HTMLDialogElement && node.open)) return;
                    onWheel(ev);
                }}
                // click/contextmenu에서 닫는다 - pointerdown에서 닫으면 이어지는 click이 아래 목록에 떨어진다.
                onPointerDown={(ev) => (pressedOutside.current = ev.target === ev.currentTarget)}
                onPointerUp={(ev) => (pressedOutside.current = pressedOutside.current && ev.target === ev.currentTarget)}
                onClick={(ev) => {
                    if (pressedOutside.current && ev.target === ev.currentTarget) usePreviewStore.getState().requestClose();
                }}
                onContextMenu={(ev) => {
                    // 프레임 밖(빈 스크롤 칸) 우클릭은 닫는다 - 닫힌 목록 위에 메뉴가 떠 어색해지므로 막는다. 안쪽은 브라우저 메뉴(복사 등)를 쓴다.
                    if (ev.target !== ev.currentTarget) return;
                    ev.preventDefault();
                    usePreviewStore.getState().requestClose();
                }}
            >
                {children}
            </div>
            {after}
        </>
    );

    // 비모달 창이다. 스크롤 잠금과 PageUp/Down 이동은 직접 처리한다. 바깥 클릭 닫기는 위 click이 맡는다(위에 뜬 팝업, 버블을 눌러도 닫히지 않게).
    return overlay.portal ? createPortal(content, overlay.portal) : content;
};
