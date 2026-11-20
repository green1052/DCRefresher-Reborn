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
        // 스크롤바 칸까지 회수해 미리보기가 창 끝까지 차지하게 한다. 칸을 남기면 fixed 배경이 그 영역에 닿지 못해
        // 페이지 배경색이 하얀 띠로 비치고 스크롤바도 한 칸 안쪽에 뜬다. 칸이 사라지며 뒤 페이지가 칸 폭만큼
        // 옆으로 밀리지만 어두운 배경 아래라 보이지 않는다.
        html.style.overflow = "hidden";
        html.style.scrollbarGutter = "auto";
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
