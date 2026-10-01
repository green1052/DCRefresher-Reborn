import {describe, expect, it} from "vitest";

import {htmlToText, sanitizeHtml} from "@/utils/sanitize";

describe("sanitizeHtml", () => {
    it("스크립트·인라인 핸들러·폼 요소를 지운다", () => {
        expect(sanitizeHtml("<p onclick=\"x()\">a</p><script>x()</script><input><form></form><style>p{}</style>")).toBe("<p>a</p>");
    });

    it("서식 style만 남기고 위치·표시·배경 이미지·음수 여백은 지운다", () => {
        const clean = sanitizeHtml("<p style=\"color: red; position: fixed; display: none; background-image: url(x); margin-top: -400px; padding: 4px; font-weight: bold\">a</p>");
        expect(clean).toContain("color: red");
        expect(clean).toContain("padding: 4px");
        expect(clean).toContain("font-weight: bold");
        expect(clean).not.toContain("position");
        expect(clean).not.toContain("display");
        expect(clean).not.toContain("background-image");
        expect(clean).not.toContain("margin-top");
        // 남는 서식이 없으면 style 속성째 뺀다.
        expect(sanitizeHtml("<p style=\"position: fixed\">a</p>")).toBe("<p>a</p>");
    });

    it("이미지·동영상·유튜브의 인라인 높이는 CSS가 이기도록 지운다", () => {
        expect(sanitizeHtml("<img style=\"height: 10px; width: 20px\">")).toBe("<img style=\"width: 20px;\" loading=\"lazy\">");
    });

    it("동영상은 컨트롤을 붙이고 디시콘·움짤은 자동 반복 재생한다", () => {
        expect(sanitizeHtml("<video src=\"a.mp4\"></video>")).toBe("<video src=\"a.mp4\" controls=\"\"></video>");
        const gif = sanitizeHtml("<video src=\"a.mp4\" data-src=\"a.gif\"></video>");
        for (const attribute of ["autoplay", "loop", "muted", "playsinline"]) expect(gif).toContain(`${attribute}=""`);
        expect(gif).not.toContain("controls");
    });

    it("링크는 새 탭으로 열고 # 앵커는 그대로 둔다", () => {
        expect(sanitizeHtml("<a href=\"https://x.com\">a</a>")).toBe("<a href=\"https://x.com\" target=\"_blank\" rel=\"noopener noreferrer\">a</a>");
        expect(sanitizeHtml("<a href=\"#c\">a</a>")).toBe("<a href=\"#c\">a</a>");
    });

    it("유튜브 embed를 iframe으로 바꾸고 팝오버 속성은 뺀다", () => {
        const clean = sanitizeHtml("<embed src=\"https://www.youtube.com/embed/abc\" width=\"1\"><button popover=\"auto\" popovertarget=\"x\">b</button>");
        expect(clean).toContain("<iframe src=\"https://www.youtube.com/embed/abc\"");
        expect(clean).toContain("allowfullscreen");
        expect(clean).not.toContain("<embed");
        expect(clean).not.toContain("popover");
    });

    it("stripMedia면 이미지·동영상·iframe·embed를 모두 뺀다", () => {
        expect(sanitizeHtml("<p>a</p><img src=\"x\"><video></video><iframe src=\"y\"></iframe><embed src=\"https://www.youtube.com/embed/abc\">", {stripMedia: true})).toBe("<p>a</p>");
    });
});

describe("htmlToText", () => {
    it("태그를 떼고 엔티티를 풀되 속성값 안의 >는 새지 않는다", () => {
        expect(htmlToText("R&amp;B <b title=\"a>b\">&lt;3</b><!-- c -->")).toBe("R&B  <3  ");
        expect(htmlToText("&amp;lt;")).toBe("&lt;");
        expect(htmlToText("plain")).toBe("plain");
    });
});
