import {ownPreviewEntry} from "@/core/preview/history";

/**
 * 오버레이에 입력하던 글. 오버레이 섀도 루트는 open이라 죽은 인스턴스가 남긴 것도 읽힌다.
 * 오버레이의 textarea는 댓글 입력칸뿐이다. 닉네임·비밀번호·캡차(input)는 짧거나 저장된 값이 있어 읽지 않는다.
 */
export const overlayDraft = (host: Element | null): string | undefined => host?.shadowRoot?.querySelector("textarea")?.value.trim() || undefined;

/**
 * 파이어폭스는 확장을 업데이트하거나 다시 켤 때 이전 스크립트를 정리 없이 없애고 새로 주입한다.
 * 죽은 인스턴스가 남긴 오버레이와 스크롤·클릭 잠금을 걷어 낸다.
 * 죽은 인스턴스가 없으면 아무것도 하지 않는다. 걷어 낸 오버레이에 입력하던 글이 있으면 돌려준다.
 */
export const cleanUpStaleInstance = (): string | undefined => {
    const stale = document.querySelector("refresher-root");
    if (!stale) return;

    const draft = overlayDraft(stale);
    stale.remove();
    const {documentElement: html, body} = document;
    // 미리보기 창은 <html> 스크롤(스크롤바 자리는 scrollbar-gutter로 남긴다)과 뒤 페이지(inert)를 잠근다.
    if (html.style.overflow === "hidden") {
        html.style.overflow = "";
        html.style.removeProperty("scrollbar-gutter");
        for (const element of body.querySelectorAll<HTMLElement>(":scope > [inert]")) element.inert = false;
    }
    // Base UI 모달은 나머지 페이지에 aria-hidden(표시 속성 data-base-ui-inert)을 단다. Base UI가 모듈 변수로 추적해 새 인스턴스가 지우지 않는다.
    // (포커스 가드는 shadow 안에 있어 오버레이와 같이 사라졌다.)
    for (const element of document.querySelectorAll("[data-base-ui-inert]")) {
        element.removeAttribute("aria-hidden");
        element.removeAttribute("inert");
        element.removeAttribute("data-base-ui-inert");
    }
    // Base UI 모달은 페이지 스크롤도 잠근다(<html>·<body> 인라인 스타일). 원래 값은 죽은 인스턴스가 들고 있어 되돌릴 수 없으므로 비운다.
    if (body.style.overflowY === "hidden" || html.hasAttribute("data-base-ui-scroll-locked")) {
        for (const prop of ["overflow-x", "overflow-y", "position", "height", "width", "box-sizing", "scroll-behavior"]) body.style.removeProperty(prop);
        for (const prop of ["overflow-x", "overflow-y", "scrollbar-gutter", "scroll-behavior"]) html.style.removeProperty(prop);
        html.removeAttribute("data-base-ui-scroll-locked");
    }
    // 죽은 인스턴스가 미리보기를 열며 바꿔 둔 기록 항목(글 주소·제목)을 목록 항목으로 되돌린다.
    // 그대로 두면 새 미리보기를 닫을 때 그 항목으로 돌아가 옛 글이 다시 열린다.
    // doc이 다르면 미리보기를 연 채 새로고침한 실제 글 페이지이므로 건드리지 않는다.
    const back = ownPreviewEntry(history.state)?.back;
    if (back) {
        history.replaceState(back.state ?? null, "", back.url);
        document.title = back.title;
    }
    return draft;
};
