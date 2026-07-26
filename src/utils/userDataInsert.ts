// 글쓴이 영역(.ub-writer)에 정보 스팬을 삽입한다.
// 컨테이너는 .addbox → .fl > span → element 순으로 잡는다.
// position:
//  - "before-ip": IP/기존 표시 앞 (메모 — IP 표시보다 먼저 보이게)
//  - "after-icon": 닉콘/IP 뒤 (글댓비, 갱차 표시)
export function insertWriterSpan(
    element: HTMLElement,
    span: HTMLElement,
    position: "before-ip" | "after-icon"
): void {
    const container =
        element.querySelector<HTMLElement>(".addbox") ??
        element.querySelector<HTMLElement>(".fl > span") ??
        element;

    if (position === "before-ip") {
        const anchor = container.querySelector<HTMLElement>(".ip, .refresherUserData");
        if (anchor?.parentElement) anchor.parentElement.insertBefore(span, anchor);
        else container.appendChild(span);
        return;
    }

    const anchor = container.querySelector<HTMLElement>(".writer_nikcon, .ip");
    if (anchor?.parentElement) anchor.parentElement.insertBefore(span, anchor.nextSibling);
    else container.appendChild(span);
}
