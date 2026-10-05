import {afterEach, describe, expect, it, vi} from "vitest";

import {checkboxFiller, highlightSearchResults, LIST_SELECTOR, notifyListReplaced, ROW_SELECTOR} from "@/core/list";
import {sendMessage} from "@/core/messaging/protocol";

vi.mock("@/core/messaging/protocol", () => ({sendMessage: vi.fn()}));

afterEach(() => {
    document.body.innerHTML = "";
});

const tbody = (head: string, rows: string): HTMLElement => {
    document.body.innerHTML = `<table class="gall_list"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    return document.querySelector("tbody")!;
};

const row = (markup: string): HTMLTableRowElement => {
    const body = document.createElement("tbody");
    body.innerHTML = markup;
    return body.rows[0]!;
};

const ADMIN_HEAD = "<th class='chkbox_th'></th><th>제목</th>";
const checkbox = (no: string): string => `<td class="gall_chk"><span><input type="checkbox" class="article_chkbox" value="${no}" checked></span></td>`;

describe("선택자", () => {
    it("목록은 id 없는 gall_list만 고르고 행은 댓글 검색 행도 고른다", () => {
        document.body.innerHTML = "<table class='gall_list'><tbody id='a'></tbody></table><table class='gall_list' id='kakao_seach_list'><tbody id='b'></tbody></table>";
        expect([...document.querySelectorAll(LIST_SELECTOR)].map((element) => element.id)).toEqual(["a"]);

        document.body.innerHTML = "<div class='ub-content'></div><table><tr class='search_comment'></tr></table><div class='other'></div>";
        expect(document.querySelectorAll(ROW_SELECTOR)).toHaveLength(2);
    });
});

describe("checkboxFiller", () => {
    it("머리에 체크박스 열이 없으면 행을 건드리지 않는다", () => {
        const fill = checkboxFiller(tbody("<th>제목</th>", ""), false);
        const target = row("<tr data-no='1'><td>제목</td></tr>");
        fill(target);
        expect(target.cells).toHaveLength(1);
    });

    it("기존 행의 칸을 복제해 글 번호만 바꾸고 체크는 푼다", () => {
        const fill = checkboxFiller(tbody(ADMIN_HEAD, `<tr data-no="10">${checkbox("10")}<td>제목</td></tr>`), false);
        const target = row("<tr data-no='20'><td>새 제목</td></tr>");
        fill(target);

        const input = target.querySelector<HTMLInputElement>("td.gall_chk input.article_chkbox")!;
        expect(target.cells[0]!.className).toBe("gall_chk");
        expect(input.value).toBe("20");
        expect(input.checked).toBe(false);
    });

    it("복제한 칸의 값이 행 번호가 아니면 그대로 둔다", () => {
        const fill = checkboxFiller(tbody(ADMIN_HEAD, `<tr data-no="10">${checkbox("on")}<td>제목</td></tr>`), false);
        const target = row("<tr data-no='20'><td>새 제목</td></tr>");
        fill(target);
        expect(target.querySelector("input")!.value).toBe("on");
    });

    it("번호 없는 행에는 빈 칸을 넣고 이미 칸이 있는 행은 그대로 둔다", () => {
        const fill = checkboxFiller(tbody(ADMIN_HEAD, `<tr data-no="10">${checkbox("10")}<td>제목</td></tr>`), false);
        const ad = row("<tr><td>AD</td></tr>");
        fill(ad);
        expect(ad.cells).toHaveLength(2);
        expect(ad.cells[0]!.innerHTML).toBe("");

        const filled = row(`<tr data-no="30">${checkbox("30")}<td>제목</td></tr>`);
        fill(filled);
        expect(filled.cells).toHaveLength(2);
    });

    it("복제할 행이 없으면 디시의 행 템플릿에 이 글 번호를 넣는다", () => {
        const list = tbody(ADMIN_HEAD, "");
        document.body.insertAdjacentHTML("beforeend", "<script type='text/x-jquery-tmpl' id='minor_td-tmpl'> <td class='tmpl'><input class='article_chkbox' value='${no}'></td> </script>");
        const fill = checkboxFiller(list, false);
        const target = row("<tr data-no='5'><td>제목</td></tr>");
        fill(target);
        expect(target.cells[0]!.className).toBe("tmpl");
        expect(target.querySelector("input")!.value).toBe("5");
    });

    it("템플릿도 없으면 빈 칸으로 열을 맞춘다", () => {
        const fill = checkboxFiller(tbody(ADMIN_HEAD, ""), false);
        const target = row("<tr data-no='5'><td>제목</td></tr>");
        fill(target);
        expect(target.cells).toHaveLength(2);
        expect(target.cells[0]!.innerHTML).toBe("");
    });

    it("댓글 검색 결과에서는 댓글 행에만 칸을 넣는다", () => {
        const fill = checkboxFiller(tbody(ADMIN_HEAD, `<tr data-no="10">${checkbox("10")}<td>제목</td></tr>`), true);
        const post = row("<tr data-no='20'><td>글</td></tr>");
        const comment = row("<tr class='search_comment' data-no='21'><td>댓글</td></tr>");
        fill(post);
        fill(comment);
        expect(post.cells).toHaveLength(1);
        expect(comment.cells).toHaveLength(2);
    });
});

describe("highlightSearchResults", () => {
    const list = (title: string): HTMLElement => {
        const body = document.createElement("tbody");
        body.innerHTML = `<tr><td class="gall_tit"><a href="#">${title}</a><a class="reply_numbox">[3]</a></td></tr>`;
        return body;
    };

    it("제목 링크의 검색어마다 span.mark로 감싸고 다른 요소는 그대로 둔다", () => {
        const body = list("<em class='icon'></em>고양이와 고양이 사진");
        const icon = body.querySelector(".icon");
        highlightSearchResults(body, "고양이");

        const anchor = body.querySelector(".gall_tit > a")!;
        expect(anchor.innerHTML).toBe("<em class=\"icon\"></em><span class=\"mark\">고양이</span>와 <span class=\"mark\">고양이</span> 사진");
        expect(anchor.querySelector(".icon")).toBe(icon);
        expect(body.querySelector(".reply_numbox")!.innerHTML).toBe("[3]");
    });

    it("검색어에 HTML이 있어도 글자로 넣는다", () => {
        const body = list("a&lt;b&gt;c");
        highlightSearchResults(body, "<b>");
        expect(body.querySelector(".mark")!.textContent).toBe("<b>");
        expect(body.querySelector("b")).toBeNull();
    });

    it("스포일러 제목은 mark spoiler로 감싼다", () => {
        const body = list("<span class='spoiler'>범인은 고양이</span>");
        highlightSearchResults(body, "고양이");
        expect(body.querySelector(".spoiler .mark")!.className).toBe("mark spoiler");
    });

    it("검색어가 없거나 없는 글자면 바꾸지 않는다", () => {
        const body = list("고양이");
        highlightSearchResults(body, "");
        highlightSearchResults(body, "강아지");
        expect(body.querySelector(".gall_tit > a")!.innerHTML).toBe("고양이");
    });
});

describe("notifyListReplaced", () => {
    it("배경에 갤러리를 알리고 실패는 삼킨다", async () => {
        vi.mocked(sendMessage).mockRejectedValue(new Error("확장 멈춤"));
        notifyListReplaced("test");
        expect(sendMessage).toHaveBeenCalledWith("refresher:listReplaced", "test");
        // 삼키지 않았다면 처리되지 않은 거부로 테스트가 실패한다.
        await Promise.resolve();
    });
});
