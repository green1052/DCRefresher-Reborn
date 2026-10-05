import {describe, expect, it, vi} from "vitest";

const fetchMock = vi.hoisted(() => (globalThis.fetch = vi.fn<typeof fetch>()));

import {urls} from "@/core/http/urls";
import {adminDeleteComment, blockUser, bump, captchaImage, deletePost, setNotice, setRecommend, userDeleteComment} from "@/core/preview/manage";

import {preData} from "../../../helpers";
import {serve} from "./net";

const MINOR = "https://gall.dcinside.com/mgallery/board/view/?id=a&no=3";
const MINI = "https://gall.dcinside.com/mini/board/view/?id=a&no=3";
const pre = (link = MINOR) => preData({gallery: "a", id: "3", link});

describe("관리 요청", () => {
    it("미니 갤러리는 mini_ API, 나머지는 minor_ API다", async () => {
        const sent = serve(fetchMock, () => "{\"result\":\"success\"}");
        await bump(pre(MINI));
        await bump(pre(MINOR));
        await bump(pre("https://gall.dcinside.com/board/view/?id=a&no=3"));
        expect(sent.map(({url}) => url)).toEqual([
            "https://gall.dcinside.com/ajax/mini_manager_board_ajax/update_bump",
            "https://gall.dcinside.com/ajax/minor_manager_board_ajax/update_bump",
            "https://gall.dcinside.com/ajax/minor_manager_board_ajax/update_bump"
        ]);
    });

    it("공통 필드 뒤에 준 순서대로 보낸다", async () => {
        const sent = serve(fetchMock, () => "{\"result\":\"success\"}");
        await deletePost({gallery: "a", id: "3", link: MINOR});
        await setNotice(pre(), true);
        await setNotice(pre(), false);
        await setRecommend(pre(), true);
        await adminDeleteComment(pre(), "77");
        expect(sent.map(({url, body}) => [url.split("/").at(-1), [...body]])).toEqual([
            ["delete_list", [["ci_t", ""], ["_GALLTYPE_", "M"], ["id", "a"], ["nos[]", "3"]]],
            ["set_notice", [["ci_t", ""], ["_GALLTYPE_", "M"], ["mode", "SET"], ["id", "a"], ["no", "3"]]],
            ["set_notice", [["ci_t", ""], ["_GALLTYPE_", "M"], ["mode", "REL"], ["id", "a"], ["no", "3"]]],
            ["set_recommend", [["ci_t", ""], ["_GALLTYPE_", "M"], ["mode", "SET"], ["id", "a"], ["nos[]", "3"]]],
            ["delete_comment", [["ci_t", ""], ["_GALLTYPE_", "M"], ["id", "a"], ["pno", "3"], ["cmt_nos[]", "77"]]]
        ]);
    });

    it("차단 옵션을 필드로 바꾼다", async () => {
        const sent = serve(fetchMock, () => "{\"result\":\"success\"}");
        await blockUser(pre(), {avoidHour: "6", avoidReason: "0", avoidReasonTxt: "도배", delChk: true, userTypeChk: false});
        expect(Object.fromEntries(sent[0]?.body ?? [])).toMatchObject({
            id: "a", "nos[]": "3", parent: "", avoid_hour: "6", avoid_reason: "0", avoid_reason_txt: "도배", del_chk: "1", avoid_type_chk: "0"
        });
    });

    it("JSON 결과와 문구를 읽는다", async () => {
        serve(fetchMock, () => "{\"result\":\"fail\",\"msg\":\"권한이 없습니다.\"}");
        expect(await bump(pre())).toEqual({success: false, message: "권한이 없습니다."});
        serve(fetchMock, () => "{\"result\":true,\"msg\":\"\"}");
        expect(await bump(pre())).toEqual({success: true, message: undefined});
        serve(fetchMock, () => "{\"result\":\"true\"}");
        expect((await bump(pre())).success).toBe(true);
    });

    it("텍스트 응답도 읽는다", async () => {
        serve(fetchMock, () => "false||정상적인 접근이 아닙니다.");
        expect(await bump(pre())).toEqual({success: false, message: "정상적인 접근이 아닙니다."});
        serve(fetchMock, () => " true ");
        expect(await bump(pre())).toEqual({success: true, message: undefined});
    });

    it("HTML 같은 다른 응답은 실패다", async () => {
        serve(fetchMock, () => "<html><body>로그인</body></html>");
        expect((await bump(pre())).success).toBe(false);
        serve(fetchMock, () => "");
        expect((await bump(pre())).success).toBe(false);
    });
});

describe("userDeleteComment", () => {
    it("비밀번호를 넣어 보내고 true만 성공이다", async () => {
        const sent = serve(fetchMock, () => "true");
        expect(await userDeleteComment(pre(), "77", "pw")).toEqual({success: true, message: undefined});
        expect(sent[0]?.url).toBe(urls.comment_remove);
        expect(Object.fromEntries(sent[0]?.body ?? [])).toEqual({
            ci_t: "", _GALLTYPE_: "M", id: "a", no: "3", re_no: "77", mode: "del", re_password: "pw", "g-recaptcha-response": ""
        });
    });

    it("비밀번호가 없으면 넣지 않는다", async () => {
        const sent = serve(fetchMock, () => "true");
        await userDeleteComment(pre(), "77", "");
        expect(sent[0]?.body.has("re_password")).toBe(false);
    });

    it("실패 문구를 준다", async () => {
        serve(fetchMock, () => "false||nomember||회원 댓글입니다.");
        expect(await userDeleteComment(pre(), "77", "")).toEqual({success: false, message: "회원 댓글입니다."});
        serve(fetchMock, () => "success");
        expect((await userDeleteComment(pre(), "77", "")).success).toBe(false);
    });
});

describe("captchaImage", () => {
    it("갤러리·종류·시각을 넣는다", () => {
        vi.spyOn(Date, "now").mockReturnValue(1000);
        expect(captchaImage(pre(MINI), "recommend")).toBe("https://gall.dcinside.com/kcaptcha/image_v3/?gall_id=a&kcaptcha_type=recommend&time=1000&_GALLTYPE_=MI");
    });
});
