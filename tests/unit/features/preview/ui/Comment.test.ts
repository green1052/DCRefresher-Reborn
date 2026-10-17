import {describe, expect, it} from "vitest";

import {extractIcon, extractIp} from "@/features/preview/ui/Comment";

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
