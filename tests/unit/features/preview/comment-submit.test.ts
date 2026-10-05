import {beforeEach, describe, expect, it, vi} from "vitest";

import {sendMessage} from "@/core/messaging/protocol";
import {submitComment, type SubmitResult, submitTxtcon} from "@/core/preview/request";
import {submitResult} from "@/core/preview/response";
import type {DcinsideDccon, PostInfo} from "@/core/preview/types";
import {isCommentPosted, postComment} from "@/features/preview/comment-submit";

import {preData} from "../../../helpers";

vi.mock("@/core/messaging/protocol", () => ({sendMessage: vi.fn()}));
vi.mock("@/core/preview/request", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/preview/request")>(),
    submitComment: vi.fn(),
    submitTxtcon: vi.fn()
}));

const post: PostInfo = {commentForm: {fields: [], serviceCode: "", checks: {}}};
const user = {name: "ㅇㅇ", pw: "1234"};
const reply = {commentNo: "10", replyNo: null};
const dccon: DcinsideDccon = {detail_idx: "d", package_idx: "p", list_img: "", title: ""};

const text = {text: "안녕", dccons: [], bigDccon: true};
const dcconContent = {text: "", dccons: [dccon], bigDccon: true};
const txtcon = {text: "글", dccons: [], bigDccon: false, txtcon: {bg: "333333", txt: "ffffff"}};

/** 보낼 때마다 차례로 응답한다. */
const respond = (...responses: string[]) => {
    const results: SubmitResult[] = responses.map(submitResult);
    const next = async () => results.shift() ?? submitResult("");
    vi.mocked(submitComment).mockImplementation(next);
    vi.mocked(submitTxtcon).mockImplementation(next);
};

beforeEach(() => {
    vi.mocked(sendMessage).mockResolvedValue("token");
});

describe("isCommentPosted", () => {
    it("새 댓글 번호면 성공이다", () => {
        expect(isCommentPosted(submitResult("12345"))).toBe(true);
    });

    it("false·빈 응답·HTML·실패 코드는 실패다", () => {
        for (const response of ["false||x", "", "  <html>로그인</html>", "code_fail", "fail1", "form_error", "not_buy", "fail"]) {
            expect(isCommentPosted(submitResult(response)), response).toBe(false);
        }
    });
});

describe("postComment", () => {
    it("글은 글 댓글로 보낸다", async () => {
        respond("123");
        expect(await postComment(preData(), post, user, text, reply, "cap")).toEqual({ok: true});
        expect(submitComment).toHaveBeenCalledWith(preData(), post, user, "안녕", "10", null, false, "cap", undefined);
        expect(submitTxtcon).not.toHaveBeenCalled();
    });

    it("디시콘은 디시콘으로 보내고 ok만 성공이다", async () => {
        respond("ok");
        expect(await postComment(preData(), post, user, dcconContent, reply)).toEqual({ok: true});
        expect(submitComment).toHaveBeenCalledWith(preData(), post, user, [dccon], "10", null, true, undefined, undefined);
        respond("123");
        expect((await postComment(preData(), post, user, dcconContent, reply)).ok).toBe(false);
    });

    it("글자콘은 글자콘으로 보내고 ok만 성공이다", async () => {
        respond("ok");
        expect(await postComment(preData(), post, user, txtcon, reply)).toEqual({ok: true});
        expect(submitTxtcon).toHaveBeenCalledWith(preData(), post, user, "글", txtcon.txtcon, "10", null, undefined, undefined);
        expect(submitComment).not.toHaveBeenCalled();
    });

    it("v3 캡차면 토큰을 받아 한 번 더 보낸다", async () => {
        respond("false||captcha||v3", "123");
        expect(await postComment(preData(), post, user, text, reply)).toEqual({ok: true});
        expect(sendMessage).toHaveBeenCalledWith("refresher:grecaptchaToken", "comment_submit");
        expect(vi.mocked(submitComment).mock.calls.map((call) => call[8])).toEqual([undefined, "token"]);
    });

    it("디시콘·글자콘은 insert_icon 토큰을 받는다", async () => {
        respond("false||captcha||v3", "ok");
        await postComment(preData(), post, user, dcconContent, reply);
        respond("false||captcha||v3", "ok");
        await postComment(preData(), post, user, txtcon, reply);
        expect(vi.mocked(sendMessage).mock.calls.map((call) => call[1])).toEqual(["insert_icon", "insert_icon"]);
    });

    it("다시 보내도 막히면 원문에서 쓰라고 한다", async () => {
        respond("false||captcha||v3", "false||captcha||v3");
        expect(await postComment(preData(), post, user, text, reply)).toEqual({ok: false, captcha: true});
    });

    it("토큰을 못 받으면 다시 보내지 않는다", async () => {
        vi.mocked(sendMessage).mockRejectedValue(new Error("no"));
        respond("false||captcha||v3");
        expect(await postComment(preData(), post, user, text, reply)).toEqual({ok: false, captcha: true});
        expect(submitComment).toHaveBeenCalledTimes(1);
    });

    it("v2 캡차도 원문에서 쓰라고 한다", async () => {
        respond("false||captcha||v2");
        expect(await postComment(preData(), post, user, text, reply)).toEqual({ok: false, captcha: true});
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("실패하면 디시 문구를 준다", async () => {
        respond("false||도배 방지");
        expect(await postComment(preData(), post, user, text, reply)).toEqual({ok: false, captcha: false, message: "도배 방지"});
        respond("false||nomember||회원만");
        expect(await postComment(preData(), post, user, text, reply)).toMatchObject({message: "회원만"});
    });

    it("알려진 실패 코드는 그 문구다", async () => {
        respond("code_fail");
        expect(await postComment(preData(), post, user, text, reply)).toMatchObject({message: "자동입력 방지 코드가 일치하지 않습니다."});
        respond("not_buy");
        expect(await postComment(preData(), post, user, dcconContent, reply)).toMatchObject({message: "구매내역이 존재하지 않는 디시콘입니다."});
    });

    it("디시콘 실패 문구는 디시콘 댓글에만 쓴다", async () => {
        respond("fail");
        expect(await postComment(preData(), post, user, txtcon, reply)).toMatchObject({message: "댓글을 작성하지 못했습니다."});
    });

    it("문구가 없으면 기본 문구다", async () => {
        respond("false");
        expect(await postComment(preData(), post, user, text, reply)).toMatchObject({message: "댓글을 작성하지 못했습니다."});
        respond("<html></html>");
        expect(await postComment(preData(), post, user, text, reply)).toMatchObject({message: "댓글을 작성하지 못했습니다."});
    });

    it("요청이 끊기면 던진다", async () => {
        vi.mocked(submitComment).mockRejectedValue(new DOMException("끊김", "AbortError"));
        await expect(postComment(preData(), post, user, text, reply)).rejects.toThrow("끊김");
    });
});
