/** 작성자 영역(.addbox → .fl > span → 자기자신)의 닉콘/IP 바로 뒤에 span을 넣는다 */
export const insertWriterSpan = (element: HTMLElement, span: HTMLElement): void => {
    const container = element.querySelector<HTMLElement>(".addbox") ?? element.querySelector<HTMLElement>(".fl > span") ?? element;
    const anchor = container.querySelector<HTMLElement>(".writer_nikcon, .ip");

    if (anchor) anchor.after(span);
    else container.append(span);
};
