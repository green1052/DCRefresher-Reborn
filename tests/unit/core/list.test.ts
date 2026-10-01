import {describe, expect, it} from "vitest";

import {checkboxFiller, highlightSearchResults} from "@/core/list";

const tbody = (html: string): HTMLTableSectionElement => {
    const table = document.createElement("table");
    table.innerHTML = html;
    return table.tBodies[0]!;
};

describe("highlightSearchResults", () => {
    it("제목 링크의 글자에서 검색어마다 span.mark로 감싸고, 링크 안의 다른 요소는 그대로 둔다", () => {
        const list = tbody(`<tbody><tr><td class="gall_tit"><a href="#"><em class="icon_img"></em>고양이 사진 고양이</a><a class="reply_numbox">고양이</a></td></tr></tbody>`);
        highlightSearchResults(list, "고양이");

        const anchor = list.querySelector("a")!;
        expect(anchor.querySelectorAll("span.mark")).toHaveLength(2);
        expect(anchor.textContent).toBe("고양이 사진 고양이");
        expect(anchor.querySelector("em.icon_img")).not.toBeNull();
        // 첫 링크(제목)만 바꾼다.
        expect(list.querySelector(".reply_numbox span")).toBeNull();
    });

    it("스포일러 제목은 mark spoiler로 감싸고, 검색어가 없으면 아무것도 하지 않는다", () => {
        const list = tbody(`<tbody><tr><td class="gall_tit"><a href="#"><span class="spoiler">결말</span> 결말 스포</a></td></tr></tbody>`);
        const before = list.innerHTML;
        highlightSearchResults(list, "");
        expect(list.innerHTML).toBe(before);

        highlightSearchResults(list, "결말");
        expect([...list.querySelectorAll("span.mark")].map((span) => span.className)).toEqual(["mark spoiler", "mark spoiler"]);
    });
});

describe("checkboxFiller", () => {
    it("머리에 체크박스 열이 없으면 행을 건드리지 않는다", () => {
        const list = tbody(`<thead><tr><th>번호</th></tr></thead><tbody><tr data-no="1"><td>1</td></tr></tbody>`);
        const row = list.rows[0]!;
        checkboxFiller(list, false)(row);
        expect(row.cells).toHaveLength(1);
    });

    it("관리자 목록이면 기존 행의 체크박스 칸을 복제해 글 번호만 바꾸고, 번호 없는 행에는 빈 칸을 넣는다", () => {
        const list = tbody(`<thead><tr><th class="chkbox_th"></th><th>번호</th></tr></thead>
<tbody><tr data-no="5"><td><input type="checkbox" class="article_chkbox" value="5" checked></td><td>5</td></tr></tbody>`);
        const fill = checkboxFiller(list, false);

        const fetched = document.createElement("tr");
        fetched.dataset.no = "6";
        fetched.innerHTML = "<td>6</td>";
        fill(fetched);
        const input = fetched.querySelector<HTMLInputElement>("input.article_chkbox")!;
        expect(input.value).toBe("6");
        expect(input.checked).toBe(false);

        const ad = document.createElement("tr");
        ad.innerHTML = "<td>AD</td>";
        fill(ad);
        expect(ad.cells).toHaveLength(2);
        expect(ad.cells[0]!.innerHTML).toBe("");

        // 이미 칸이 있으면 또 넣지 않는다.
        fill(fetched);
        expect(fetched.cells).toHaveLength(2);
    });

    it("댓글 검색 결과에서는 댓글 행에만 칸을 넣는다", () => {
        const list = tbody(`<thead><tr><th class="chkbox_th"></th></tr></thead><tbody></tbody>`);
        const fill = checkboxFiller(list, true);
        const post = document.createElement("tr");
        const comment = Object.assign(document.createElement("tr"), {className: "search_comment"});
        fill(post);
        fill(comment);
        expect(post.cells).toHaveLength(0);
        expect(comment.cells).toHaveLength(1);
    });
});
