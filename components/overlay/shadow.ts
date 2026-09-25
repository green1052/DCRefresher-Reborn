/**
 * 오버레이 shadow root와 포털 대상.
 * Radix 포털 기본값은 document.body라 격리된 스타일(Radix Themes)이 안 먹으므로 모든 Content에 container로 넘긴다.
 */
export const overlay: { root?: ShadowRoot; portal?: HTMLElement } = {};
