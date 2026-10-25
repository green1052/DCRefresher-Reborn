/** 요소가 붙을 때 포커스한다 (ref 콜백). autoFocus는 처음 마운트에만 붙으므로 나중에 나타나는 입력칸에 쓴다. */
export const focusOnMount = (element: HTMLElement | null): void => element?.focus();
