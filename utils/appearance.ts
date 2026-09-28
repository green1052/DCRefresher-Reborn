/**
 * Radix Themes는 조상 요소의 light/dark 클래스를 보고 색을 바꾼다 (https://www.radix-ui.com/themes/docs/theme/dark-mode).
 * Theme에 appearance를 넘기지 않고 이 클래스만 바꾼다
 */
export const setAppearance = (root: Element, dark: boolean): void => {
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
};

/** 시스템 다크 모드를 따라간다. 첫 렌더 전에 불러 밝은 화면이 잠깐 비치지 않게 한다 (옵션·팝업) */
export const followSystemAppearance = (root: Element = document.documentElement): void => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setAppearance(root, query.matches);
    query.addEventListener("change", (ev) => setAppearance(root, ev.matches));
};
