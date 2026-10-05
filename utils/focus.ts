/** 요소가 붙을 때 포커스한다 (ref 콜백). Preact는 autoFocus 속성으로 포커스를 옮기지 않으므로 나중에 나타나는 입력칸에 쓴다. */
export const focusOnMount = (element: HTMLElement | null): void => element?.focus();
