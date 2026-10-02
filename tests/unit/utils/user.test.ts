import {describe, expect, it} from "vitest";

import {isGalleryManager} from "@/utils/user";

describe("isGalleryManager", () => {
    it("관리 버튼·체크박스 열이 없어도 매니저 말머리 탭이 보이면 관리자다 (#271)", () => {
        // 미니 갤러리의 매니저 탭 목록: 관리 버튼도, 목록 머리의 체크박스 열도 없다.
        document.body.innerHTML = "<table class=\"gall_list\"><thead><tr><th>번호</th></tr></thead></table>"
            + "<ul><li><a href=\"javascript:;\" onclick=\"listSearchHead('all')\">전체</a></li></ul>";
        expect(isGalleryManager()).toBe(false);

        document.body.insertAdjacentHTML("beforeend", "<a href=\"javascript:;\" onclick=\"listSearchHead(999)\" class=\"font_red on\">매니저</a>");
        expect(isGalleryManager()).toBe(true);
    });

    it("목록 머리의 체크박스 열로도 판단한다", () => {
        document.body.innerHTML = "<table class=\"gall_list\"><thead><tr><th class=\"chkbox_th\"></th></tr></thead></table>";
        expect(isGalleryManager()).toBe(true);
    });
});
