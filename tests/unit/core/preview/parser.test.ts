import {describe, expect, it} from "vitest";

import {ADULT_ERROR, parsePostInfo, SECRET_ERROR} from "@/core/preview/parser";

const image = (no: number): string => `<img src="" data-original="https://dcimg1.dcinside.com/viewimage.php?no=${no}" onclick="imgPop('https://image.dcinside.com/viewimagePop.php?no=${no}')">`;

const page = (body: string, extra = ""): string => `<!DOCTYPE html><html><body>
<div class="view_content_wrap">
<div class="gallview_head ub-content">
  <h3><span class="title_headtext">[말머리]</span><span class="title_subject">제목<script>x()</script></span></h3>
  <div class="gall_writer ub-writer" data-nick="닉" data-uid="uid1" data-ip=""><img src="https://nstatic.dcinside.com/fix_nik.gif"></div>
  <div class="fr"><span class="gall_date" title="2026-09-30 12:00:00">2026.09.30 12:00:00</span><span class="gall_count">조회 123</span><span class="gall_reply_num">추천 4</span><span class="gall_comment">댓글 7</span></div>
</div>
<div class="writing_view_box"><div id="zzbang_div">짤</div><div class="write_div">${body}</div></div>
</div>
<div class="btn_recommend_box"><span class="sup_num"><span class="smallnum">2</span></span><span class="down_num">1</span></div>
<input type="hidden" id="e_s_n_o" value="esno"><input type="hidden" name="code_recommend" value="rc"><input type="hidden" name="v_cur_t" value="t1">
<div class="cmt_write_box"><form id="focus_cmt"><input name="service_code" value="svc"><input id="check_6" value="6"><input name="comment_code"></form></div>
<script id="reply-setting-tmpl"></script><script>_d('DV')</script>
<script>$(document).data('comment_id', 'cid'); $(document).data('comment_no', 'cno');</script>
${extra}
</body></html>`;

describe("parsePostInfo", () => {
    it("머리·본문·폼 값을 꺼내고 본문 위 짤방과 제목 스크립트는 뺀다", () => {
        const info = parsePostInfo(page("<p>본문</p>"))!;
        expect(info.header).toBe("말머리");
        expect(info.title).toBe("제목");
        expect(info.user).toEqual({nick: "닉", id: "uid1", ip: undefined, image: "https://nstatic.dcinside.com/fix_nik.gif"});
        expect(info.date).toBe("2026-09-30 12:00:00");
        expect(info.views).toBe("123");
        expect(info.upvotes).toBe("4");
        expect(info.fixedUpvotes).toBe("2");
        expect(info.downvotes).toBe("1");
        expect(info.commentCount).toBe(7);
        expect(info.contents).toBe("<div class=\"write_div\"><p>본문</p></div>");
        expect(info.writeText).toBe("본문");
        expect(info.commentId).toBe("cid");
        expect(info.commentNo).toBe("cno");
        expect(info.esno).toBe("esno");
        expect(info.recommendCode).toBe("rc");
        expect(info.v_cur_t).toBe("t1");
        expect(info.requireCommentCaptcha).toBe(true);
        expect(info.requireCaptcha).toBe(false);
        expect(info.commentForm).toEqual({
            fields: [["service_code", "svc"], ["check_6", "6"], ["comment_code", ""]],
            serviceCode: "svc",
            dValue: "DV",
            checks: {check_6: "6", check_7: "", check_8: ""},
            gallNickName: undefined
        });
    });

    it("지연 로딩 이미지의 주소를 src로 옮기고 원본 보기 주소를 data-pop에 둔다. 3개부터 번호를 단다", () => {
        const two = parsePostInfo(page(image(1) + image(2)))!.contents!;
        expect(two).toContain("src=\"https://dcimg1.dcinside.com/viewimage.php?no=1\"");
        expect(two).toContain("data-pop=\"https://image.dcinside.com/viewimagePop.php?no=1\"");
        expect(two).not.toContain("refresher-imgnum");

        const three = parsePostInfo(page(image(1) + image(2) + image(3)))!.contents!;
        expect(three.match(/class="refresher-imgnum" data-num="(\d)"/g)).toHaveLength(3);
    });

    it("본문 안의 같은 이름 입력칸은 폼 값을 덮지 않는다", () => {
        const info = parsePostInfo(page("<input id=\"e_s_n_o\" value=\"fake\"><input name=\"code_recommend\" value=\"fake\">"))!;
        expect(info.esno).toBe("esno");
        expect(info.recommendCode).toBe("rc");
    });

    it("글이 아닌 문서는 undefined, 성인 인증·비밀글은 각각 던진다", () => {
        expect(parsePostInfo("<html><body><p>없음</p></body></html>")).toBeUndefined();
        expect(() => parsePostInfo("<html><body><script>location.href='/error/adult/'</script></body></html>")).toThrow(ADULT_ERROR);
        expect(() => parsePostInfo("<html><body><div class=\"adult_certify\"></div></body></html>")).toThrow(ADULT_ERROR);
        expect(() => parsePostInfo(page("<div class=\"mini_pwcheck\"></div>"))).toThrow(SECRET_ERROR);
    });
});
