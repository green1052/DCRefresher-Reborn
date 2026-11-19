import { useEffect } from "preact/hooks";

import {focusedElement} from "@/components/useReturnFocus";

/** 창이 떠 있는 동안 뒤 페이지를 잠근다 - 비모달이라 inert로 막아 Tab, 스크린 리더가 목록으로 나가지 않게 한다(오버레이는 남긴다).
 * 키보드로 열었을 때만 연 요소로 포커스를 돌려준다 - 마우스로 연 창까지 돌리면 새로고침 모듈이 갱신을 멈춘다. */
export const useScrollLock = (active: boolean): void => {
    useEffect(() => {
        if (!active) return;

        const focused = focusedElement();
        const opener = focused?.matches(":focus-visible") ? focused : null;
        const html = document.documentElement;
        const previous = {overflow: html.style.overflow, gutter: html.style.scrollbarGutter};
        // 스크롤바가 실제로 있을 때만 그 자리를 남겨, 잠가도 뒤 페이지가 옆으로 밀리지 않게 한다. 짧은 페이지에 걸면 오히려 빈 홈이 생긴다.
        if (window.innerWidth > html.clientWidth) html.style.scrollbarGutter = "stable";
        html.style.overflow = "hidden";
        const blocked = document.body.querySelectorAll<HTMLElement>(":scope > :not(refresher-root, [data-refresher-ui], [inert])");
        for (const element of blocked) element.inert = true;

        return () => {
            html.style.overflow = previous.overflow;
            html.style.scrollbarGutter = previous.gutter;
            for (const element of blocked) element.inert = false;
            opener?.focus({preventScroll: true});
        };
    }, [active]);
};
