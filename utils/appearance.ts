/** Tailwind dark: 변형은 조상의 dark 클래스를 본다. daisyUI 테마(data-theme=light/black)와 color-scheme도 여기서 정한다. */
const setAppearance = (root: HTMLElement, dark: boolean): void => {
    root.classList.toggle("dark", dark);
    root.dataset.theme = dark ? "black" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
};

/** 시스템 다크 모드를 따라간다 (옵션, 팝업). 첫 렌더 전에 불러 밝은 화면이 비치지 않게 한다. */
export const followSystemAppearance = (): void => {
    const root = document.documentElement;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setAppearance(root, query.matches);
    query.addEventListener("change", (ev) => setAppearance(root, ev.matches));
};

/** 디시 다크모드(#css-darkmode 스타일시트)를 따라간다 (오버레이). 감시를 멈추는 함수를 돌려준다. */
export const followDcAppearance = (root: HTMLElement): (() => void) => {
    const apply = (): void => setAppearance(root, document.getElementById("css-darkmode") !== null);
    apply();
    const observer = new MutationObserver(apply);
    // 글쓰기 페이지에서는 디시가 새로고침 없이 링크를 body에 붙였다 뗀다 (_js__common.js darkmode()).
    for (const target of [document.head, document.body]) {
        if (target) observer.observe(target, {childList: true});
    }
    return () => observer.disconnect();
};
