import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {extractIcon, extractIp, noticeDeleteWarning} from "@/features/preview/ui/Comment";

describe("extractIcon", () => {
    it("디시처럼 작은따옴표를 쓴 닉콘 img의 src를 읽는다", () => {
        expect(extractIcon("<a href='/gallog' class='writer_nikcon '><img src='https://nstatic.dcinside.com/dc/w/images/fix_nik.gif' border=0 title='고정닉'></a>"))
            .toBe("https://nstatic.dcinside.com/dc/w/images/fix_nik.gif");
        expect(extractIcon("<a class='writer_nikcon'><img src='https://nstatic.dcinside.com/dc/w/images/nik.gif'></a>"))
            .toBe("https://nstatic.dcinside.com/dc/w/images/nik.gif");
    });

    it("src가 다른 속성 뒤에 오거나 따옴표가 없어도 읽는다", () => {
        expect(extractIcon(`<a class="writer_nikcon"><img border="0" title="반고정닉" src="nik.gif"></a>`)).toBe("nik.gif");
        expect(extractIcon("<a class=writer_nikcon><img src=fix_nik.gif></a>")).toBe("fix_nik.gif");
    });

    it("닉콘이 없으면 undefined다", () => {
        expect(extractIcon(undefined)).toBeUndefined();
        expect(extractIcon("<span class='ip'>(1.2)</span>")).toBeUndefined();
    });
});

describe("extractIp", () => {
    it("유동의 span.ip에서 괄호 안 IP를 읽는다", () => {
        expect(extractIp("<span class='ip'>(1.2)</span>")).toBe("1.2");
        expect(extractIp(`<span class="ip">(118.235)</span>`)).toBe("118.235");
    });

    it("IP 칸이 없으면 undefined다", () => {
        expect(extractIp(undefined)).toBeUndefined();
        expect(extractIp("<a class='writer_nikcon'><img src='nik.gif'></a>")).toBeUndefined();
    });
});

describe("noticeDeleteWarning", () => {
    // 2026-10-18 12:00:00 KST. 연도 없는 시각의 연도도 이 시계에서 채워지므로 Date.now를 통째로 고정한다.
    beforeEach(() => vi.useFakeTimers({now: new Date("2026-10-18T03:00:00Z")}));
    afterEach(() => vi.useRealTimers());
    const fields: [string, string][] = [["notice_comment_del_avoid", "1"], ["notice_comment_del_avoid_msg", "댓삭튀"]];

    it("댓삭튀 차단 갤러리의 5분 안 된 댓글이면 디시 경고를 낸다", () => {
        expect(noticeDeleteWarning(fields, "10.18 11:56:00")).toBe("공지글에 작성한 댓글을 5분 내 삭제 시 매니저에 의해 [댓삭튀] 사유로 차단됩니다.");
    });

    it("5분이 지났거나 규칙이 꺼져 있으면 경고하지 않는다", () => {
        expect(noticeDeleteWarning(fields, "10.18 11:55:00")).toBeUndefined();
        expect(noticeDeleteWarning([["notice_comment_del_avoid", "0"]], "10.18 11:59:00")).toBeUndefined();
        expect(noticeDeleteWarning(fields, "")).toBeUndefined();
    });
});
