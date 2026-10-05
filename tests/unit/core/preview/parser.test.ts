import {afterEach, describe, expect, it} from "vitest";

import {ADULT_ERROR, parsePostInfo, SECRET_ERROR} from "@/core/preview/parser";
import type {PostInfo} from "@/core/preview/types";

const IMG = (n: number) => `https://dcimg8.dcinside.co.kr/viewimage.php?id=a&no=${n}`;

/** 디시 글 페이지의 뼈대. 본문(.writing_view_box)과 그 밖(head·tail)을 바꿔 넣는다. */
const page = ({head = "", body = "<div class=\"write_div\">본문</div>", tail = ""}: { head?: string; body?: string; tail?: string } = {}) => `<html><body>
<div class="view_content_wrap">
  <div class="gallview_head">
    <h3><span class="title_headtext">[잡담]</span><span class="title_subject">제목<script>document.write("광고")</script></span></h3>
    <div class="gall_writer" data-nick="닉" data-uid="uid1" data-ip=""><img src="https://nstatic.dcinside.com/nik.gif"></div>
    <span class="gall_date" title="2026-09-26 02:29:40">2026.09.26 02:29:40</span>
    <div class="fr"><span class="gall_count">조회 1234</span><span class="gall_reply_num">추천 5</span><span class="gall_comment">댓글 7</span></div>
    ${head}
  </div>
  <div class="writing_view_box">${body}</div>
</div>
<div class="btn_recommend_box"><p class="sup_num"><span class="smallnum">3</span></p><p class="down_num">2</p></div>
<input type="hidden" id="e_s_n_o" value="esno1">
<input type="hidden" name="code_recommend" value="rec1">
<input type="hidden" name="v_cur_t" value="vcur">
<input id="adult_article" type="hidden"><input type="hidden" name="rand_x" value="rv">
<div class="cmt_write_box"><form id="focus_cmt">
  <input name="service_code" value="sc1"><input id="cmt_gall" value="g"><input name="gall_nick_name" value="갤닉">
</form></div>
<input type="hidden" id="check_6" value="c6"><input type="hidden" id="check_7" value="c7">
<input type="checkbox" id="use_gall_nick">
<script id="reply-setting-tmpl" type="text/x-jquery-tmpl"></script><script>_d('DVAL');</script>
<script>$(document).data('comment_id', 'cid'); $(document).data('comment_no', '42');</script>
${tail}
</body></html>`;

const parse = (html: string): PostInfo => {
    const info = parsePostInfo(html);
    if (!info) throw new Error("글이 아니다");
    return info;
};

const contents = (info: PostInfo): HTMLElement => {
    const box = document.createElement("div");
    box.innerHTML = info.contents ?? "";
    return box;
};

afterEach(() => {
    document.cookie = "img_numbering=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("parsePostInfo", () => {
    it("머리 값을 꺼낸다", () => {
        const info = parse(page());
        expect(info).toMatchObject({
            header: "잡담",
            title: "제목",
            date: "2026-09-26 02:29:40",
            user: {nick: "닉", id: "uid1", ip: undefined, image: "https://nstatic.dcinside.com/nik.gif"},
            views: "1234",
            upvotes: "5",
            fixedUpvotes: "3",
            downvotes: "2",
            commentCount: 7,
            commentId: "cid",
            commentNo: "42",
            esno: "esno1",
            recommendCode: "rec1",
            v_cur_t: "vcur",
            randomParam: {name: "rand_x", value: "rv"},
            writeText: "본문",
            requireCaptcha: false,
            requireCommentCaptcha: false
        });
    });

    it("댓글 폼 값을 꺼낸다", () => {
        expect(parse(page()).commentForm).toEqual({
            fields: [["service_code", "sc1"], ["cmt_gall", "g"], ["gall_nick_name", "갤닉"]],
            serviceCode: "sc1",
            dValue: "DVAL",
            checks: {check_6: "c6", check_7: "c7", check_8: ""},
            gallNickName: "갤닉"
        });
    });

    it("갤닉 입력칸이 없으면 gallNickName이 없다", () => {
        expect(parse(page().replace("<input type=\"checkbox\" id=\"use_gall_nick\">", "")).commentForm.gallNickName).toBeUndefined();
    });

    it("title이 없으면 표시된 날짜를 쓴다", () => {
        expect(parse(page().replace(" title=\"2026-09-26 02:29:40\"", "")).date).toBe("2026.09.26 02:29:40");
    });

    it("댓글 0개는 0으로, 숫자가 아니면 undefined다", () => {
        expect(parse(page().replace("댓글 7", "댓글 0")).commentCount).toBe(0);
        expect(parse(page().replace("댓글 7", "댓글 [7/1]")).commentCount).toBeUndefined();
    });

    it("캡차 표시를 읽는다", () => {
        const info = parse(page({tail: "<div class=\"recommend_kapcode\"></div><div class=\"cmt_write_box\"><input name=\"comment_code\"></div>"}));
        expect(info.requireCaptcha).toBe(true);
        expect(info.requireCommentCaptcha).toBe(true);
    });

    it("본문 안의 같은 이름 값은 폼 값을 덮지 않는다", () => {
        const body = "<input id=\"e_s_n_o\" value=\"fake\"><input name=\"service_code\" value=\"fake\">"
            + "<script>$(document).data('comment_id', 'fake');</script>";
        const info = parse(page({body}));
        expect(info.esno).toBe("esno1");
        expect(info.commentForm.serviceCode).toBe("sc1");
        expect(info.commentId).toBe("cid");
    });

    it("본문 위 짤방과 광고 자리를 뺀다", () => {
        const box = contents(parse(page({body: "<div id=\"zzbang_div\">짤방</div><div id=\"ad_nv_slot\">광고</div><p>글</p>"})));
        expect(box.textContent).toBe("글");
    });

    it("지연 로딩 이미지 주소를 src로 옮긴다", () => {
        const box = contents(parse(page({body: "<img data-original=\"https://a.dcinside.com/1.jpg\"><img data-original=\"https://a.dcinside.com/2.jpg\" data-block=\"1\">"})));
        const [shown, hidden] = box.querySelectorAll("img");
        expect(shown?.getAttribute("src")).toBe("https://a.dcinside.com/1.jpg");
        // 관리자가 가린 이미지는 가림 버튼을 누를 때 옮긴다.
        expect(hidden?.hasAttribute("src")).toBe(false);
    });

    it("원본 보기 주소를 data-pop에 둔다", () => {
        const box = contents(parse(page({body: "<img src=\"x.jpg\" onclick=\"javascript:imgPop('https://image.dcinside.com/viewimagePop.php?no=1','image','fullscreen=yes');\">"})));
        expect(box.querySelector("img")?.dataset.pop).toBe("https://image.dcinside.com/viewimagePop.php?no=1");
    });

    it("첨부 미디어가 3개 이상이면 번호를 단다", () => {
        const body = `<img src="${IMG(1)}"><img class="og-img" src="${IMG(9)}"><video data-src="${IMG(2)}"></video><img src="https://other.com/a.jpg"><img data-original="${IMG(3)}">`;
        const box = contents(parse(page({body})));
        expect(Array.from(box.querySelectorAll<HTMLElement>(".refresher-imgnum"), (wrap) => [wrap.dataset.num, wrap.firstElementChild?.tagName])).toEqual([
            ["1", "IMG"], ["2", "VIDEO"], ["3", "IMG"]
        ]);
    });

    it("첨부 미디어가 2개면 번호를 달지 않는다", () => {
        const box = contents(parse(page({body: `<img src="${IMG(1)}"><img src="${IMG(2)}">`})));
        expect(box.querySelector(".refresher-imgnum")).toBeNull();
    });

    it("번호 끄기 쿠키면 번호를 달지 않는다", () => {
        document.cookie = "img_numbering=0";
        const box = contents(parse(page({body: `<img src="${IMG(1)}"><img src="${IMG(2)}"><img src="${IMG(3)}">`})));
        expect(box.querySelector(".refresher-imgnum")).toBeNull();
    });

    it("글이 아닌 문서는 undefined다", () => {
        expect(parsePostInfo("<html><body><p>없는 글</p></body></html>")).toBeUndefined();
    });

    it("성인 인증 안내면 ADULT_ERROR를 던진다", () => {
        expect(() => parsePostInfo("<script>location.href='/error/adult/?r=1'</script>")).toThrow(ADULT_ERROR);
        expect(() => parsePostInfo("<div class=\"adult_certify\"></div>")).toThrow(ADULT_ERROR);
    });

    it("본문에 성인 주소가 적혀 있어도 글로 읽는다", () => {
        expect(parse(page({body: "/error/adult 링크"})).title).toBe("제목");
    });

    it("미니 갤러리 비밀글이면 SECRET_ERROR를 던진다", () => {
        expect(() => parsePostInfo(page({body: "<div class=\"mini_pwcheck\"><input type=\"password\"></div>"}))).toThrow(SECRET_ERROR);
    });

    it("머리가 없어도 빈 값으로 읽는다", () => {
        const info = parse("<div class=\"writing_view_box\"><p>글</p></div>");
        expect(info.title).toBeUndefined();
        expect(info.user).toBeUndefined();
        expect(info.commentCount).toBeUndefined();
        expect(info.contents).toBe("<p>글</p>");
    });
});
