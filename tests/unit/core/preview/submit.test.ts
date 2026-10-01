import {afterEach, describe, expect, it, vi} from "vitest";

import {ajax} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {submitComment} from "@/core/preview/request";
import type {DcinsideDccon, GalleryPreData, PostInfo} from "@/core/preview/types";

import {dValueFor} from "../../../../e2e/dcinside";

const preData: GalleryPreData = {
    gallery: "test", id: "7", link: "https://gall.dcinside.com/board/view/?id=test&no=7", notice: false, recommend: false, type: "icon_txt", commentCount: 0
};

const post = (dValue: string | undefined): PostInfo => ({
    commentForm: {
        // 폼 필드는 그대로 보내되 service_code·gallery_no·clickbutton은 빼거나 갈아 끼운다.
        fields: [["service_code", "abc0123456789"], ["gallery_no", "99"], ["clickbutton", "x"], ["check_6", "keep"]],
        serviceCode: "abc0123456789",
        dValue
    }
}) as PostInfo;

/** 보낸 주소와 폼을 모은다. 응답은 text로 준다. */
const mockPost = (response: string) => {
    const sent: { url: string; body: URLSearchParams }[] = [];
    vi.spyOn(ajax, "post").mockImplementation(((url: string, options?: { body?: URLSearchParams }) => {
        sent.push({url, body: options!.body!});
        return {text: async () => response};
    }) as never);
    return sent;
};

afterEach(() => vi.restoreAllMocks());

describe("submitComment", () => {
    it("_d() 값을 풀어 service_code 끝 10자리를 갈아 끼우고, 폼 필드와 댓글 필드를 같이 보낸다", async () => {
        const sent = mockPost("1234");
        const result = await submitComment(preData, post(dValueFor("XYZ!@#0987")), {name: "ㅇㅇ", pw: "pw12"}, "안녕", null, null, false);

        expect(result.result).toBe("1234");
        expect(sent).toHaveLength(1);
        const {url, body} = sent[0]!;
        expect(url).toBe(urls.comments_submit);
        expect(body.get("service_code")).toBe("abcXYZ!@#0987");
        expect(body.get("check_6")).toBe("keep");
        expect(body.has("gallery_no")).toBe(false);
        expect(body.has("clickbutton")).toBe(false);
        expect(Object.fromEntries(["id", "no", "c_gall_id", "c_gall_no", "name", "password", "memo", "use_gall_nick"].map((key) => [key, body.get(key)]))).toEqual({
            id: "test", no: "7", c_gall_id: "test", c_gall_no: "7", name: "ㅇㅇ", password: "pw12", memo: "안녕", use_gall_nick: "N"
        });
        // 답글·캡차·큰 디시콘이 아니면 그 필드는 아예 넣지 않는다.
        for (const key of ["c_no", "reply_no", "code", "g-recaptcha-token", "bigdccon"]) expect(body.has(key), key).toBe(false);
    });

    it("답글은 부모와 답할 댓글 번호를, 캡차는 코드와 토큰을 넣는다", async () => {
        const sent = mockPost("1235");
        await submitComment(preData, post(dValueFor("abcdefghij")), {name: ""}, "답", "10", "11", false, "ab12", "token");

        const {body} = sent[0]!;
        expect([body.get("c_no"), body.get("reply_no"), body.get("code"), body.get("g-recaptcha-token")]).toEqual(["10", "11", "ab12", "token"]);
        // 회원은 비밀번호가 없다.
        expect(body.has("password")).toBe(false);
    });

    it("디시콘은 디시콘 주소로 패키지·디시콘 번호를 쉼표로 이어 보낸다", async () => {
        const sent = mockPost("ok");
        const dccons = [{package_idx: "1", detail_idx: "11"}, {package_idx: "2", detail_idx: "22"}] as DcinsideDccon[];
        await submitComment(preData, post(dValueFor("abcdefghij")), {name: "ㅇㅇ", pw: "pw"}, dccons, null, null, true);

        const {url, body} = sent[0]!;
        expect(url).toBe(urls.dccon_comments_submit);
        expect(Object.fromEntries(["input_type", "double_con_chk", "package_idx", "detail_idx", "bigdccon"].map((key) => [key, body.get(key)]))).toEqual({
            input_type: "comment", double_con_chk: "1", package_idx: "1,2", detail_idx: "11,22", bigdccon: "1"
        });
        expect(body.has("memo")).toBe(false);
    });

    it.each([
        ["_d() 값이 없을 때", undefined],
        ["_d() 값이 빈 문자열일 때", ""],
        ["디시가 형식을 바꿔 숫자가 아닐 때", dValueFor("abcdefghij").replace(/^./, "!")]
    ])("%s 틀린 service_code로 보내지 않고 알린다", async (_name, dValue) => {
        const sent = mockPost("1");
        const result = await submitComment(preData, post(dValue), {name: "ㅇㅇ", pw: "pw"}, "안녕", null, null, false);

        expect(sent).toEqual([]);
        expect(result).toMatchObject({result: "false", message: expect.stringContaining("댓글 폼을 읽지 못했습니다")});
    });
});
