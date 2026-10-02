import {beforeEach, describe, expect, it, vi} from "vitest";

import {sendMessage} from "@/core/messaging/protocol";
import {submitComment, type SubmitResult, submitTxtcon} from "@/core/preview/request";
import type {DcinsideDccon, GalleryPreData, PostInfo} from "@/core/preview/types";
import {isCommentPosted, postComment} from "@/features/preview/comment-submit";

vi.mock("@/core/preview/request", async (original) => ({
    ...await original<typeof import("@/core/preview/request")>(),
    submitComment: vi.fn(),
    submitTxtcon: vi.fn()
}));
vi.mock("@/core/messaging/protocol", () => ({sendMessage: vi.fn()}));

const preData = {gallery: "test", id: "1", link: "https://gall.dcinside.com/board/view/?id=test&no=1"} as GalleryPreData;
const post = {} as PostInfo;
const user = {name: "ㅇㅇ", pw: "pw"};
const reply = {commentNo: null, replyNo: null};
const dccon = {detail_idx: "1"} as DcinsideDccon;
const result = (text: string): SubmitResult => {
    const [res, message, detail] = text.split("||");
    return {result: res!, message, detail};
};

beforeEach(() => {
    vi.mocked(submitComment).mockReset();
    vi.mocked(submitTxtcon).mockReset();
    vi.mocked(sendMessage).mockReset();
});

describe("isCommentPosted", () => {
    it("새 댓글 번호만 성공이고, false·빈 응답·HTML·실패 코드는 실패다", () => {
        expect(isCommentPosted(result("123456"))).toBe(true);
        for (const text of ["false", "", "  <html>", "code_fail", "fail1"]) expect(isCommentPosted(result(text))).toBe(false);
    });
});

describe("postComment", () => {
    it("글은 새 댓글 번호, 디시콘·글자콘은 ok일 때 성공이다", async () => {
        vi.mocked(submitComment).mockResolvedValue(result("123"));
        expect(await postComment(preData, post, user, {text: "글", dccons: [], bigDccon: false}, reply)).toEqual({ok: true});
        expect(await postComment(preData, post, user, {text: "", dccons: [dccon], bigDccon: true}, reply)).toEqual({ok: false, captcha: false, message: "댓글을 작성하지 못했습니다."});
        // 디시콘은 디시콘 목록과 대왕콘 여부를 넘긴다.
        expect(vi.mocked(submitComment).mock.calls[1]?.[3]).toEqual([dccon]);
        expect(vi.mocked(submitComment).mock.calls[1]?.[6]).toBe(true);

        vi.mocked(submitTxtcon).mockResolvedValue(result("ok"));
        expect(await postComment(preData, post, user, {text: "글자", dccons: [], bigDccon: false, txtcon: {bg: "000000", txt: "ffffff"}}, reply)).toEqual({ok: true});
        expect(submitTxtcon).toHaveBeenCalledOnce();
    });

    it("v3 캡차를 요구하면 토큰을 받아 한 번 더 보내고, 그래도 막히면 원문에서 쓰라고 한다", async () => {
        vi.mocked(submitComment).mockResolvedValueOnce(result("false||captcha||v3")).mockResolvedValueOnce(result("123"));
        vi.mocked(sendMessage).mockResolvedValue("token");
        expect(await postComment(preData, post, user, {text: "글", dccons: [], bigDccon: false}, reply)).toEqual({ok: true});
        expect(sendMessage).toHaveBeenCalledWith("refresher:grecaptchaToken", "comment_submit");
        expect(vi.mocked(submitComment).mock.calls[1]?.at(-1)).toBe("token");

        vi.mocked(submitComment).mockResolvedValue(result("false||captcha||v3"));
        vi.mocked(sendMessage).mockResolvedValue(undefined);
        expect(await postComment(preData, post, user, {text: "", dccons: [dccon], bigDccon: false}, reply)).toEqual({ok: false, captcha: true});
        expect(sendMessage).toHaveBeenLastCalledWith("refresher:grecaptchaToken", "insert_icon");
    });

    it("실패하면 디시가 준 문구, 알려진 실패 코드의 문구, 둘 다 없으면 기본 문구를 준다", async () => {
        vi.mocked(submitComment).mockResolvedValueOnce(result("false||도배는 금지입니다."));
        expect(await postComment(preData, post, user, {text: "글", dccons: [], bigDccon: false}, reply)).toMatchObject({message: "도배는 금지입니다."});
        vi.mocked(submitComment).mockResolvedValueOnce(result("code_fail"));
        expect(await postComment(preData, post, user, {text: "글", dccons: [], bigDccon: false}, reply)).toMatchObject({message: "자동입력 방지 코드가 일치하지 않습니다."});
        vi.mocked(submitComment).mockResolvedValueOnce(result("<html>"));
        expect(await postComment(preData, post, user, {text: "글", dccons: [], bigDccon: false}, reply)).toMatchObject({message: "댓글을 작성하지 못했습니다."});
        // fail은 디시콘을 보냈을 때만 디시콘 문구다.
        vi.mocked(submitComment).mockResolvedValueOnce(result("fail"));
        expect(await postComment(preData, post, user, {text: "글", dccons: [], bigDccon: false}, reply)).toMatchObject({message: "댓글을 작성하지 못했습니다."});
        vi.mocked(submitComment).mockResolvedValueOnce(result("fail"));
        expect(await postComment(preData, post, user, {text: "", dccons: [dccon], bigDccon: false}, reply)).toMatchObject({message: "디시콘 입력에 실패하였습니다."});
    });

    it("요청이 끊기면 던진다", async () => {
        vi.mocked(submitComment).mockRejectedValue(new Error("timeout"));
        await expect(postComment(preData, post, user, {text: "글", dccons: [], bigDccon: false}, reply)).rejects.toThrow("timeout");
    });
});
