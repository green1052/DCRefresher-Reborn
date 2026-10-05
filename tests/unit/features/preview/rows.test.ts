/**
 * @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
 */
import {beforeEach, describe, expect, it} from "vitest";

import {adjacentPreData, buildPreData, isBlurHidden, isTextPost, listRows, rowPostKey} from "@/features/preview/rows";
import {type BlockView, useUiStore} from "@/stores/ui";

import {preData} from "../../../helpers";
import {postHref, renderList, rowOf} from "./list";

const view = (revealed: boolean): BlockView => ({blur: true, blurReveal: false, replyRemove: false, revealed, duplicate: null});

beforeEach(() => useUiStore.setState({blockView: null}));

const ids = (list: { pre: { id: string } }[]) => list.map(({pre}) => pre.id);

describe("buildPreData", () => {
    it("글 주소·아이콘·댓글 수를 읽는다", () => {
        const rows = renderList([{no: 5, icon: "icon_recomtxt", comments: "[12/3]"}]);
        expect(buildPreData(rowOf(rows, 5))).toEqual({
            gallery: "test", id: "5", title: "글 5", link: postHref(5), notice: false, recommend: true, type: "icon_recomtxt", commentCount: 12
        });
    });

    it("공지 아이콘을 읽는다", () => {
        const rows = renderList([{no: 1, icon: "icon_notice"}]);
        expect(buildPreData(rowOf(rows, 1))).toMatchObject({notice: true, recommend: false, type: "icon_notice", commentCount: 0});
    });

    it("제목 칸에서도 행의 값을 읽는다", () => {
        const rows = renderList([{no: 2, icon: "icon_pic", comments: "[4]"}]);
        const word = rowOf(rows, 2).querySelector<HTMLElement>(".ub-word");
        if (!word) throw new Error("제목 칸이 없다");
        expect(buildPreData(word)).toMatchObject({id: "2", type: "icon_pic", commentCount: 4});
    });

    it("경로형 주소도 읽는다", () => {
        const rows = renderList([{no: 3, href: "https://gall.dcinside.com/mgallery/board/view/id/abc/3"}]);
        expect(buildPreData(rowOf(rows, 3))).toMatchObject({gallery: "abc", id: "3"});
    });

    it("아이콘이 없으면 텍스트 글이다", () => {
        const row = document.createElement("div");
        row.innerHTML = `<a href="${postHref(9)}">글</a>`;
        expect(buildPreData(row)?.type).toBe("icon_txt");
    });

    it("같은 출처의 http 주소는 페이지 프로토콜로 맞춘다", () => {
        const rows = renderList([{no: 4, href: "http://gall.dcinside.com/board/view/?id=test&no=4"}]);
        expect(buildPreData(rowOf(rows, 4))?.link).toBe(postHref(4));
    });

    it("디시 주소가 아니면 null이다", () => {
        const href = (value: string) => buildPreData(rowOf(renderList([{no: 1, href: value}]), 1));
        expect(href("javascript:alert(1)")).toBeNull();
        expect(href("https://evil.example/board/view/?id=test&no=1")).toBeNull();
        expect(href("http://other.dcinside.com/board/view/?id=test&no=1")).toBeNull();
    });

    it("글 주소가 아니면 null이다", () => {
        expect(buildPreData(rowOf(renderList([{no: 1, href: "https://gall.dcinside.com/board/lists/?id=test"}]), 1))).toBeNull();
        const empty = document.createElement("div");
        expect(buildPreData(empty)).toBeNull();
        empty.innerHTML = "<a>링크 없음</a>";
        expect(buildPreData(empty)).toBeNull();
    });

    it("댓글 수 링크는 글 링크로 보지 않는다", () => {
        const row = document.createElement("div");
        row.innerHTML = `<a class="reply_numbox" href="${postHref(1)}">[1]</a><a href="${postHref(2)}">글</a>`;
        expect(buildPreData(row)?.id).toBe("2");
    });
});

describe("rowPostKey", () => {
    it("행의 글 키를 준다", () => {
        expect(rowPostKey(rowOf(renderList([{no: 7}]), 7))).toBe("test:7");
    });

    it("링크가 나중에 붙은 행도 다시 읽는다", () => {
        const row = document.createElement("tr");
        expect(rowPostKey(row)).toBeNull();
        row.innerHTML = `<td><a href="${postHref(8)}">글</a></td>`;
        expect(rowPostKey(row)).toBe("test:8");
    });
});

describe("listRows", () => {
    it("안 보이는 행·열 수 없는 행·겹친 글을 뺀다", () => {
        renderList([{no: 1}, {no: 2, hidden: true}, {no: 3, href: "https://addc.dcinside.com/ad"}, {no: 4}, {no: 1}, {no: 5}]);
        expect(ids(listRows())).toEqual(["1", "4", "5"]);
    });
});

describe("adjacentPreData", () => {
    it("앞뒤 글을 준다", () => {
        renderList([{no: 1}, {no: 2}, {no: 3}]);
        expect(adjacentPreData(preData({id: "2", link: postHref(2)}), 1)?.id).toBe("3");
        expect(adjacentPreData(preData({id: "2", link: postHref(2)}), -1)?.id).toBe("1");
    });

    it("끝이거나 목록에 없으면 null이다", () => {
        renderList([{no: 1}, {no: 2}]);
        expect(adjacentPreData(preData({id: "2", link: postHref(2)}), 1)).toBeNull();
        expect(adjacentPreData(preData({id: "9", link: postHref(9)}), 1)).toBeNull();
    });

    it("블러 행과 숨긴 행을 건너뛴다", () => {
        renderList([{no: 1}, {no: 2, className: "refresherBlur"}, {no: 3, hidden: true}, {no: 4}]);
        useUiStore.setState({blockView: view(false)});
        expect(adjacentPreData(preData({id: "1", link: postHref(1)}), 1)?.id).toBe("4");
        expect(adjacentPreData(preData({id: "4", link: postHref(4)}), -1)?.id).toBe("1");
    });

    it("지금 글이 블러 행이어도 제자리를 찾는다", () => {
        renderList([{no: 1}, {no: 2, className: "refresherBlur"}, {no: 3}]);
        useUiStore.setState({blockView: view(false)});
        expect(adjacentPreData(preData({id: "2", link: postHref(2)}), 1)?.id).toBe("3");
    });

    it("가린 내용 보기 중이면 블러 행도 연다", () => {
        renderList([{no: 1}, {no: 2, className: "refresherBlur"}, {no: 3}]);
        useUiStore.setState({blockView: view(true)});
        expect(adjacentPreData(preData({id: "1", link: postHref(1)}), 1)?.id).toBe("2");
    });
});

describe("isBlurHidden", () => {
    it("블러 행 안이면 가린 것이다", () => {
        const rows = renderList([{no: 1, className: "refresherBlur"}, {no: 2}]);
        const title = rowOf(rows, 1).querySelector(".ub-word");
        if (!title) throw new Error("제목 칸이 없다");
        expect(isBlurHidden(title)).toBe(true);
        expect(isBlurHidden(rowOf(rows, 2))).toBe(false);
    });
});

describe("isTextPost", () => {
    it("텍스트 아이콘만 텍스트 글이다", () => {
        expect(isTextPost(preData({type: "icon_txt"}))).toBe(true);
        expect(isTextPost(preData({type: "icon_recomtxt"}))).toBe(true);
        expect(isTextPost(preData({type: "icon_pic"}))).toBe(false);
        expect(isTextPost(preData({type: "icon_recomimg"}))).toBe(false);
    });
});
