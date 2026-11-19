import type { TargetedKeyboardEvent as KeyboardEvent } from "preact";

/** 단추 묶음에서 Tab 정지점을 하나로 묶는다(roving tabindex). 단추마다 tabIndex={선택됨 ? 0 : -1}을 붙이고, 묶음에 이 함수를 onKeyDown으로 건다. */
export const rovingKeyDown = (ev: KeyboardEvent<HTMLElement>): void => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    const items = [...ev.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])")].filter((element) => element.checkVisibility());
    if (items.length < 2) return;
    // shadow DOM 안에서는 document.activeElement가 호스트로 리타겟팅되므로 뿌리에서 찾는다.
    const active = (ev.currentTarget.getRootNode() as Document | ShadowRoot).activeElement;
    const current = items.indexOf(active as HTMLElement);
    if (current === -1) return;
    ev.preventDefault();
    const next = ev.key === "ArrowRight" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items[next]!.focus();
};
