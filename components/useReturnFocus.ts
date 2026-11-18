import {type RefObject, useLayoutEffect, useState} from "react";

/** 포커스된 요소. 오버레이처럼 shadow DOM 안이면 그 안까지 따라 들어간다. */
export const focusedElement = (): HTMLElement | null => {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element instanceof HTMLElement ? element : null;
};

/** 포커스를 받는 가장 가까운 조상(탭 패널 등). 누른 버튼이 막혀 포커스가 body로 떨어질 때 돌아갈 곳이다. */
export const panelOf = (from: Element | null | undefined): HTMLElement | null | undefined => from?.parentElement?.closest<HTMLElement>("[tabindex]");

export const focusPanel = (from: Element | null | undefined): void => panelOf(from)?.focus({preventScroll: true});

// 트리거 없이 연 창의 포커스 - Base UI가 안 돌려주는 경우(트리거 없음, 언마운트 종료)에도 닫을 때 연 요소로 돌려준다.
export const useReturnFocus = (popup: RefObject<HTMLElement | null>) => {
    const [opener] = useState(focusedElement);
    // 키보드로 열었는지(연 요소에 포커스 링이 보였는지). 창이 포커스를 가져간 뒤에는 알 수 없으므로 열 때 잰다.
    const [keyboard] = useState(() => Boolean(opener?.matches(":focus-visible")));
    // 연 요소가 줄 삭제로 사라졌거나 막혔으면 그 조상 패널로 돌아간다.
    const target = (): HTMLElement | null | undefined =>
        opener && (!opener.isConnected || opener.matches(":disabled")) ? panelOf(opener) : opener;

    const restoreFocus = (): void => {
        const current = focusedElement();
        if (!current || current === document.body || popup.current?.contains(current)) target()?.focus({preventScroll: true});
    };
    useLayoutEffect(() => restoreFocus, []);

    return {
        /** 키보드로 열었을 때만 창 안으로 포커스를 옮긴다 (initialFocus). 마우스로 열었으면 그 자리에 둔다. */
        keyboard,
        finalFocus: (): HTMLElement | true => target() ?? true,
        /** 닫힌 직후 포커스가 아직 돌아오지 않았을 때 돌려준다. */
        restoreFocus,
        /** 연 요소로 포커스를 옮긴다. 이 창에서 다른 창을 열 때 먼저 불러 두면 그 창이 닫힐 때 여기로 돌아온다. */
        returnFocus: (): void => target()?.focus({preventScroll: true})
    };
};
