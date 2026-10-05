/**
 * 오버레이 포털 대상.
 * Base UI 포털 기본값은 document.body라 shadow 안의 스타일이 안 먹으므로 포털을 쓰는 부품(components/ui의 dialog·popover·select·tooltip)이 container로 넘긴다.
 * 옵션·팝업에서는 비어 있어 body에 그린다.
 */
export const overlay: { portal?: HTMLElement } = {};
