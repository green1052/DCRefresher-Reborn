import {describe, expect, it} from "vitest";

import {buildPreData, rowPostKey} from "@/features/preview/rows";

const rowWith = (href: string, extra = ""): HTMLElement => {
    const row = document.createElement("tr");
    row.className = "ub-content";
    row.innerHTML = `<td class="gall_tit"><a href="${href}">제목</a>${extra}</td>`;
    return row;
};

describe("buildPreData", () => {
    it("디시 글 주소에서 갤러리·번호·댓글 수를 읽는다", () => {
        expect(buildPreData(rowWith("https://gall.dcinside.com/board/view/?id=game&no=12", "<span class=\"reply_num\">[3/1]</span>"))).toMatchObject({
            gallery: "game", id: "12", commentCount: 3, type: "icon_txt"
        });
        // 경로형 주소 (/board/view/id/갤러리/번호).
        expect(buildPreData(rowWith("https://gall.dcinside.com/board/view/id/game/34"))).toMatchObject({gallery: "game", id: "34"});
    });

    it("디시 주소가 아니면 열지 않는다 (O 키·키 반전으로 그 주소로 이동하므로)", () => {
        expect(buildPreData(rowWith("javascript:alert(1)//?id=game&no=1"))).toBeNull();
        expect(buildPreData(rowWith("https://evil.example/board/view/?id=game&no=1"))).toBeNull();
        expect(buildPreData(rowWith("https://gall.dcinside.com/board/lists/?id=game"))).toBeNull();
    });
});

describe("rowPostKey", () => {
    it("링크가 아직 없던 행도 나중에 다시 읽는다 (문서를 읽는 중에는 행이 링크보다 먼저 붙는다)", () => {
        const row = document.createElement("tr");
        row.className = "ub-content";
        expect(rowPostKey(row)).toBeNull();
        row.innerHTML = "<td class=\"gall_tit\"><a href=\"https://gall.dcinside.com/board/view/?id=game&no=7\">제목</a></td>";
        expect(rowPostKey(row)).toBe("game:7");
    });
});
