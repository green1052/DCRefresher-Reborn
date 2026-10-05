import {describe, expect, it} from "vitest";

import {htmlToText, sanitizeHtml} from "@/utils/sanitize";

/** 정화한 HTML을 요소로 다시 읽는다. */
const parse = (html: string, stripMedia = false): HTMLElement => {
    const root = document.createElement("div");
    root.innerHTML = sanitizeHtml(html, {stripMedia});
    return root;
};

describe("sanitizeHtml", () => {
    it("스크립트와 인라인 핸들러를 지운다", () => {
        const root = parse("<p onclick=\"alert(1)\">글</p><script>alert(1)</script><img src=\"x.png\" onerror=\"alert(1)\">");
        expect(root.querySelector("script")).toBeNull();
        expect(root.querySelector("p")?.hasAttribute("onclick")).toBe(false);
        expect(root.querySelector("img")?.hasAttribute("onerror")).toBe(false);
    });

    it("댓글 HTML의 남는 </div> 뒤도 버리지 않는다", () => {
        expect(sanitizeHtml("<p>앞</p></div><p>뒤</p>")).toContain("뒤");
    });

    it("유튜브 embed는 같은 주소의 iframe으로 바꾼다", () => {
        const root = parse("<embed type=\"application/x-shockwave-flash\" src=\"https://www.youtube.com/embed/abc?rel=0\" width=\"1\">");
        const iframe = root.querySelector("iframe");
        expect(iframe?.getAttribute("src")).toBe("https://www.youtube.com/embed/abc?rel=0");
        expect(iframe?.getAttribute("width")).toBe("560");
        expect(iframe?.hasAttribute("allowfullscreen")).toBe(true);
        expect(root.querySelector("embed")).toBeNull();
    });

    it("유튜브가 아닌 embed는 버린다", () => {
        const root = parse("<embed src=\"https://evil.example/x.swf\">");
        expect(root.querySelector("embed, iframe")).toBeNull();
    });

    it("서식 style만 남긴다", () => {
        const p = parse("<p style=\"color: red; position: fixed; display: none; background-image: url(x); font-size: 12px; margin-left: 4px\">a</p>").querySelector("p")!;
        expect(p.style.color).toBe("red");
        expect(p.style.fontSize).toBe("12px");
        expect(p.style.marginLeft).toBe("4px");
        expect(p.style.position).toBe("");
        expect(p.style.display).toBe("");
        expect(p.style.backgroundImage).toBe("");
    });

    it("음수 여백은 지운다", () => {
        const p = parse("<p style=\"margin-top: -400px; margin-bottom: 3px\">a</p>").querySelector("p")!;
        expect(p.style.marginTop).toBe("");
        expect(p.style.marginBottom).toBe("3px");
    });

    it("이미지·유튜브의 높이는 지우고 다른 요소의 높이는 둔다", () => {
        const root = parse("<img src=\"a.png\" style=\"height: 50px; width: 10px\"><div style=\"height: 50px\">a</div><iframe src=\"https://www.youtube.com/embed/x\" style=\"height: 300px\"></iframe>");
        expect(root.querySelector("img")?.style.height).toBe("");
        expect(root.querySelector("img")?.style.width).toBe("10px");
        expect(root.querySelector("div")?.style.height).toBe("50px");
        expect(root.querySelector("iframe")?.hasAttribute("style")).toBe(false);
    });

    it("남은 서식이 없으면 style 속성을 뗀다", () => {
        expect(parse("<p style=\"position: absolute\">a</p>").querySelector("p")?.hasAttribute("style")).toBe(false);
    });

    it("MathML의 style은 통째로 지운다", () => {
        expect(parse("<math style=\"color: red\"><mi>x</mi></math>").querySelector("math")?.hasAttribute("style")).toBe(false);
    });

    it("일반 동영상에는 컨트롤을 단다", () => {
        const video = parse("<video src=\"a.mp4\"></video>").querySelector("video")!;
        expect(video.hasAttribute("controls")).toBe(true);
        expect(video.hasAttribute("autoplay")).toBe(false);
    });

    it("움짤·디시콘 동영상은 컨트롤 없이 자동 반복한다", () => {
        const root = parse("<video data-src=\"a.gif\" src=\"a.mp4\"></video><video class=\"written_dccon\" src=\"b.mp4\"></video><video src=\"https://dcimg5.dcinside.com/dccon.php?no=1\"></video>");
        for (const video of root.querySelectorAll("video")) {
            expect(video.hasAttribute("controls")).toBe(false);
            for (const attribute of ["autoplay", "loop", "muted", "playsinline"]) expect(video.hasAttribute(attribute)).toBe(true);
        }
    });

    it("이미지·iframe은 lazy로 부른다", () => {
        const root = parse("<img src=\"a.png\"><iframe src=\"https://www.youtube.com/embed/x\"></iframe>");
        expect(root.querySelector("img")?.getAttribute("loading")).toBe("lazy");
        expect(root.querySelector("iframe")?.getAttribute("loading")).toBe("lazy");
    });

    it("iframe allow는 재생 권한만 남긴다", () => {
        const root = parse("<iframe src=\"https://www.youtube.com/embed/x\" allow=\"autoplay; camera; Fullscreen 'self'; clipboard-write\"></iframe><iframe src=\"https://a.example\" allow=\"camera; microphone\"></iframe>");
        const [kept, dropped] = root.querySelectorAll("iframe");
        expect(kept?.getAttribute("allow")).toBe("autoplay; Fullscreen 'self'");
        expect(dropped?.hasAttribute("allow")).toBe(false);
    });

    it("링크는 새 탭으로 열고 # 앵커는 그대로 둔다", () => {
        const [external, anchor] = parse("<a href=\"https://gall.dcinside.com\">a</a><a href=\"#top\">b</a>").querySelectorAll("a");
        expect(external?.getAttribute("target")).toBe("_blank");
        expect(external?.getAttribute("rel")).toBe("noopener noreferrer");
        expect(anchor?.hasAttribute("target")).toBe(false);
    });

    it("<style>·폼 요소·popover·background 속성을 뺀다", () => {
        const root = parse("<style>*{}</style><form><input><textarea></textarea><select></select></form><button popover popovertarget=\"x\">b</button><table background=\"x.png\"></table>");
        expect(root.querySelector("style, form, input, textarea, select")).toBeNull();
        expect(root.querySelector("button")?.hasAttribute("popovertarget")).toBe(false);
        expect(root.querySelector("button")?.hasAttribute("popover")).toBe(false);
        expect(root.querySelector("table")?.hasAttribute("background")).toBe(false);
    });

    it("stripMedia면 미디어를 모두 뺀다", () => {
        const root = parse("<p>글</p><img src=\"a.png\"><video src=\"a.mp4\"></video><iframe src=\"https://www.youtube.com/embed/x\"></iframe><embed src=\"https://www.youtube.com/embed/x\"><audio src=\"a.mp3\"></audio>", true);
        expect(root.querySelector("img, video, iframe, embed, audio")).toBeNull();
        expect(root.querySelector("p")?.textContent).toBe("글");
    });
});

describe("htmlToText", () => {
    it("태그를 떼고 엔티티를 푼다", () => {
        expect(htmlToText("<p>R&amp;B &lt;3&nbsp;&gt;</p>")).toBe(" R&B <3 > ");
    });

    it("&amp;lt;는 한 번만 푼다", () => {
        expect(htmlToText("&amp;lt;")).toBe("&lt;");
    });

    it("속성값 속 >와 주석 글자는 본문으로 새지 않는다", () => {
        expect(htmlToText("<a title=\"a>b\">링크</a><!-- <b>숨김</b> -->")).toBe(" 링크  ");
    });

    it("태그·엔티티가 없으면 그대로 둔다", () => {
        expect(htmlToText("그냥 글")).toBe("그냥 글");
    });
});
