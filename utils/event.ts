/** 실제 이벤트 대상. document/window 리스너에선 오버레이(shadow DOM) 안 요소가 shadow host로 재지정되므로 composedPath로 복원 */
export const eventTarget = (event: Event): EventTarget | null => event.composedPath()[0] ?? event.target;

/** 입력칸에 타이핑 중인지 (단축키 무시용) */
export const isTyping = (event: Event): boolean => {
    const target = eventTarget(event);
    return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
};
