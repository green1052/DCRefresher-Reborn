/**
 * 유저 정보 영역(.addbox → .fl > span → 자기자신)에 span을 삽입한다.
 *
 * @param position "before-ip": IP/기존 배지 앞 (메모), "after-icon": 닉콘/IP 바로 뒤 (글댓비·갱차)
 */
export const insertWriterSpan = (element: HTMLElement, span: HTMLElement, position: "before-ip" | "after-icon"): void => {
    const container =
        element.querySelector<HTMLElement>(".addbox") ?? element.querySelector<HTMLElement>(".fl > span") ?? element;

    const anchor = container.querySelector<HTMLElement>(position === "before-ip" ? ".ip, .refresherUserData" : ".writer_nikcon, .ip");

    if (position === "after-icon" && anchor) {
        anchor.after(span);
        return;
    }

    if (anchor) {
        anchor.before(span);
        return;
    }

    container.append(span);
};
