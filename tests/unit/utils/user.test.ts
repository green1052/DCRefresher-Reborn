import {afterEach, describe, expect, it} from "vitest";

import {isGalleryManager, loggedInUserId, nickType} from "@/utils/user";

afterEach(() => {
    document.body.innerHTML = "";
});

describe("nickType", () => {
    it("닉콘 파일명으로 고정닉·반고정닉을 가린다", () => {
        expect(nickType("https://nstatic.dcinside.com/dc/w/images/fix_nik.gif")).toBe("FIXED");
        expect(nickType("https://nstatic.dcinside.com/dc/w/images/fix_managernik.gif")).toBe("FIXED");
        expect(nickType("https://nstatic.dcinside.com/dc/w/images/nik.gif")).toBe("HALF_FIXED");
        expect(nickType("https://nstatic.dcinside.com/dc/w/images/managernik.gif")).toBe("HALF_FIXED");
    });

    it("모르거나 대소문자가 다른 닉콘은 유동이다", () => {
        expect(nickType("https://a/unknown.gif")).toBe("UNFIXED");
        expect(nickType("https://a/FIX_NIK.gif")).toBe("UNFIXED");
        expect(nickType("")).toBe("UNFIXED");
    });
});

describe("isGalleryManager", () => {
    it("관리 버튼·체크박스 열·매니저 탭 중 하나가 있으면 관리자다", () => {
        expect(isGalleryManager()).toBe(false);
        for (const html of [
            "<div class=\"useradmin_btnbox\"><button>관리</button></div>",
            "<table class=\"gall_list\"><thead><tr><th class=\"chkbox_th\"></th></tr></thead></table>",
            "<a onclick=\"listSearchHead(999)\">매니저</a>"
        ]) {
            document.body.innerHTML = html;
            expect(isGalleryManager()).toBe(true);
        }
    });
});

describe("loggedInUserId", () => {
    it("로그인 박스의 갤로그 주소에서 ID를 읽는다", () => {
        document.body.innerHTML = "<div id=\"login_box\"><div class=\"user_info\"><a class=\"writer_nikcon\" onclick=\"window.open('//gallog.dcinside.com/my-id_1')\"></a></div></div>";
        expect(loggedInUserId()).toBe("my-id_1");
    });

    it("로그인하지 않았으면 없다", () => {
        expect(loggedInUserId()).toBeUndefined();
    });
});
