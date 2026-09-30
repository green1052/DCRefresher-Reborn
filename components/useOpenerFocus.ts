import {useState} from "react";

/** 포커스된 요소. 오버레이처럼 shadow DOM 안이면 그 안까지 따라 들어간다 */
export const focusedElement = (): HTMLElement | null => {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element instanceof HTMLElement ? element : null;
};

/** 포커스를 받는 가장 가까운 조상(탭 패널 등)으로 포커스를 옮긴다. 누른 버튼이 막혀 포커스가 body로 떨어질 때 돌아갈 곳이다 */
export const focusPanel = (from: Element | null | undefined): void => from?.parentElement?.closest<HTMLElement>("[tabindex]")?.focus({preventScroll: true});

/**
 * Trigger 없이 여는 창(다이얼로그·버블)의 포커스. 창과 같이 마운트되는 컴포넌트에서 불러 Content에 넘긴다.
 * Radix는 Trigger로만 포커스를 돌려주므로, 그대로 두면 닫을 때 포커스가 body로 떨어져 Tab이 페이지 처음부터 다시 시작된다.
 * 마운트하는 렌더에서 포커스된 요소(연 요소)를 기억해 두었다가 닫을 때 돌려준다
 */
export const useOpenerFocus = () => {
    const [opener] = useState(focusedElement);
    // 닫는 사이 연 버튼이 막혔으면(전체 삭제로 목록이 비었거나 초기화 중) 가까운 조상으로 돌린다
    const focusOpener = (): void => {
        if (opener?.matches(":disabled")) focusPanel(opener);
        else opener?.focus({preventScroll: true});
    };

    return {
        /** 연 요소로 포커스를 옮긴다. 이 창에서 다른 창을 열 때 먼저 불러 두면 그 창이 닫힐 때 여기로 돌아온다 */
        returnFocus: focusOpener,
        /** 키보드로 열었을 때(연 요소에 포커스 링이 보일 때)만 창 안으로 포커스를 옮긴다. 마우스로 열었으면 그 자리에 둔다 */
        onOpenAutoFocus: (ev: Event): void => {
            if (!opener?.matches(":focus-visible")) ev.preventDefault();
        },
        onCloseAutoFocus: (ev: Event): void => {
            ev.preventDefault();
            // 닫힌 창 안에 있던 포커스는 body로 떨어져 있다. 그사이 다른 곳(새로 뜬 창의 입력칸 등)으로 간 포커스는 빼앗지 않는다
            const current = focusedElement();
            if (!current || current === document.body) focusOpener();
        }
    };
};
