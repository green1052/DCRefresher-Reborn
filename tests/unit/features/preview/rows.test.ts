// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {describe, expect, it} from "vitest";

import {buildPreData} from "@/features/preview/rows";

/** 목록 행 (tr.ub-content). 링크·아이콘 클래스·댓글 칸 글자는 주지 않으면 뺀다. */
const listRow = ({href, title = "제목", icon, reply}: {href?: string; title?: string; icon?: string; reply?: string} = {}): HTMLElement => {
    const table = document.createElement("table");
    const iconHtml = icon ? `<em class="${icon}"></em>` : "";
    const link = href === undefined ? title : `<a href="${href}">${title}</a>`;
    const replyHtml = reply === undefined ? "" : `<a class="reply_numbox"><span class="reply_num">${reply}</span></a>`;
    table.innerHTML = `<tbody><tr class="ub-content"><td class="gall_tit">${iconHtml}${link}${replyHtml}</td></tr></tbody>`;
    return table.querySelector("tr")!;
};

describe("buildPreData", () => {
    it("일반 글 행에서 갤러리·글 번호·제목·댓글 수를 읽는다", () => {
        expect(buildPreData(listRow({href: "/board/view/?id=test&no=12&page=1", title: " 안녕 ", icon: "icon_img icon_pic", reply: "[3/1]"}))).toEqual({
            gallery: "test",
            id: "12",
            title: "안녕",
            link: "https://gall.dcinside.com/board/view/?id=test&no=12&page=1",
            notice: false,
            recommend: false,
            type: "icon_pic",
            commentCount: 3
        });
    });

    it("제목 칸에서 읽어도 행의 아이콘과 댓글 수를 쓴다", () => {
        const cell = listRow({href: "/board/view/?id=test&no=12", icon: "icon_img icon_pic", reply: "[7]"}).querySelector<HTMLElement>(".gall_tit")!;
        expect(buildPreData(cell)).toMatchObject({type: "icon_pic", commentCount: 7});
    });

    it("공지 행은 notice, 개념글 행은 recommend다", () => {
        expect(buildPreData(listRow({href: "/board/view/?id=test&no=1", icon: "icon_img icon_notice"}))).toMatchObject({notice: true, recommend: false, type: "icon_notice"});
        expect(buildPreData(listRow({href: "/board/view/?id=test&no=2", icon: "icon_img icon_recomimg"}))).toMatchObject({notice: false, recommend: true, type: "icon_recomimg"});
    });

    it("아이콘·댓글 칸이 없으면 댓글 없는 텍스트 글이다", () => {
        expect(buildPreData(listRow({href: "/board/view/?id=test&no=1"}))).toMatchObject({type: "icon_txt", commentCount: 0, notice: false, recommend: false});
    });

    it("경로형 글 주소에서 갤러리와 글 번호를 읽는다", () => {
        expect(buildPreData(listRow({href: "https://gall.dcinside.com/board/view/id/other/345"}))).toMatchObject({gallery: "other", id: "345"});
    });

    it("이슈 행의 http:// 링크는 페이지 프로토콜로 맞춘다", () => {
        expect(buildPreData(listRow({href: "http://gall.dcinside.com/board/view/?id=issue&no=5"})))
            .toMatchObject({gallery: "issue", id: "5", link: "https://gall.dcinside.com/board/view/?id=issue&no=5"});
    });

    it.each([
        "https://evil.com/board/view/?id=test&no=1",
        "javascript:alert(1)",
        "http://m.dcinside.com/board/test/1",
        "/board/lists/?id=test",
        "http://"
    ])("%s 링크는 열지 않는다", (href) => {
        expect(buildPreData(listRow({href}))).toBeNull();
    });

    it("링크가 없거나 href가 비면 열지 않는다", () => {
        expect(buildPreData(listRow())).toBeNull();
        expect(buildPreData(listRow({href: ""}))).toBeNull();
    });
});
