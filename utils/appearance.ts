/** 테마(forest)는 항상 어두워서 앱은 항상 다크다. dark: 변형, 본문 반전(.dark 규칙), color-scheme이 여기에 따른다. */
export const setDarkAppearance = (root: HTMLElement): void => {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
};
