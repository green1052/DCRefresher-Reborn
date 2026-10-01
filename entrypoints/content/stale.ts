import {ownPreviewEntry} from "@/core/preview/history";
import {isRecord} from "@/utils/record";

/**
 * 파이어폭스는 확장을 업데이트하거나 다시 켤 때 이전 스크립트를 정리 없이 없애고 새로 주입한다.
 * 죽은 인스턴스가 남긴 오버레이와 스크롤·클릭 잠금을 걷어 낸다.
 * 죽은 인스턴스가 없으면 아무것도 하지 않는다.
 */
export const cleanUpStaleInstance = (): void => {
    const stale = document.querySelector("refresher-root");
    if (!stale) return;

    stale.remove();
    const {documentElement: html, body} = document;
    // 미리보기 창은 <html> 스크롤과 뒤 페이지(inert)를, Radix 다이얼로그는 <body> 스크롤·바깥 클릭을 잠근다.
    if (html.style.overflow === "hidden") {
        html.style.overflow = "";
        for (const element of body.querySelectorAll<HTMLElement>(":scope > [inert]")) element.inert = false;
    }
    if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
    body.removeAttribute("data-scroll-locked");
    // Radix 모달은 나머지 페이지에 aria-hidden(표시 속성 data-aria-hidden)을 달고 body 앞뒤에 포커스 가드를 넣는다.
    // 가드는 Radix가 모듈 변수로 추적해 새 인스턴스가 지우지 않는다.
    for (const element of document.querySelectorAll("[data-aria-hidden]")) {
        element.removeAttribute("aria-hidden");
        element.removeAttribute("data-aria-hidden");
    }
    for (const guard of document.querySelectorAll("[data-radix-focus-guard]")) guard.remove();
    // 죽은 인스턴스가 미리보기를 열며 바꿔 둔 기록 항목(글 주소·제목)을 목록 항목으로 되돌린다.
    // 그대로 두면 새 미리보기를 닫을 때 그 항목으로 돌아가 옛 글이 다시 열린다.
    // doc이 다르면 미리보기를 연 채 새로고침한 실제 글 페이지이므로 건드리지 않는다.
    const back = ownPreviewEntry(history.state)?.back;
    if (isRecord(back) && typeof back.url === "string") {
        history.replaceState(back.state ?? null, "", back.url);
        if (typeof back.title === "string") document.title = back.title;
    }
};
