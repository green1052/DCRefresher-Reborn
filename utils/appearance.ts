/**
 * Tailwind(shadcn)의 dark: 변형과 토큰은 조상 요소의 dark 클래스를 보고 색을 바꾼다 (assets/styles/tailwind.css).
 * 스크롤바·폼 컨트롤도 어둡도록 color-scheme도 여기서 정한다.
 */
const setAppearance = (root: HTMLElement, dark: boolean): void => {
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    root.style.colorScheme = dark ? "dark" : "light";
};

/** 시스템 다크 모드를 따라간다. 첫 렌더 전에 불러 밝은 화면이 잠깐 비치지 않게 한다 (옵션·팝업). */
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
