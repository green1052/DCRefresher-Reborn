/** 디시 글 목록 마크업. 미리보기 기능이 보는 것(행·제목 칸·아이콘·댓글 수·작성자 칸)만 담는다. */

// jsdom에는 checkVisibility가 없다. display: none인 조상이 있으면 안 보이는 것으로 본다.
if (!("checkVisibility" in Element.prototype)) {
    Object.defineProperty(Element.prototype, "checkVisibility", {
        configurable: true,
        value(this: Element): boolean {
            for (let element: Element | null = this; element; element = element.parentElement) {
                if (getComputedStyle(element).display === "none") return false;
            }
            return this.isConnected;
        }
    });
}

export interface Row {
    no: number;
    gallery?: string;
    /** 목록 아이콘 클래스 (icon_txt, icon_pic, icon_notice …). */
    icon?: string;
    comments?: string;
    /** 행에 붙일 클래스 (refresherBlur 등). */
    className?: string;
    hidden?: boolean;
    href?: string;
}

export const postHref = (no: number, gallery = "test") => `https://gall.dcinside.com/board/view/?id=${gallery}&no=${no}`;

const rowHtml = ({no, gallery = "test", icon = "icon_txt", comments, className = "", hidden, href = postHref(no, gallery)}: Row) => `
<tr class="ub-content ${className}" data-no="${no}"${hidden ? " style=\"display: none\"" : ""}>
  <td class="gall_tit ub-word"><a href="${href}"><em class="icon_img ${icon}"></em>글 ${no}</a>${comments ? `<a class="reply_numbox" href="${href}&t=cv"><span class="reply_num">${comments}</span></a>` : ""}</td>
  <td class="gall_writer ub-writer"><span class="nickname">ㅇㅇ</span></td>
  <td class="gall_date">01:00</td>
</tr>`;

/** 목록을 문서에 그린다. 행 요소를 번호로 돌려준다. */
export const renderList = (rows: Row[]): Map<number, HTMLElement> => {
    document.body.innerHTML = `<table class="gall_list"><tbody>${rows.map(rowHtml).join("")}</tbody></table>`;
    return new Map(Array.from(document.querySelectorAll<HTMLElement>(".ub-content"), (row) => [Number(row.dataset.no), row]));
};

/** 행을 목록 끝에 붙인다 (새로고침으로 들어온 행). */
export const appendRow = (row: Row): HTMLElement => {
    const body = document.querySelector(".gall_list tbody");
    body?.insertAdjacentHTML("beforeend", rowHtml(row));
    const element = body?.lastElementChild;
    if (!(element instanceof HTMLElement)) throw new Error("목록이 없다");
    return element;
};

export const rowOf = (rows: Map<number, HTMLElement>, no: number): HTMLElement => {
    const row = rows.get(no);
    if (!row) throw new Error(`${no}번 행이 없다`);
    return row;
};
