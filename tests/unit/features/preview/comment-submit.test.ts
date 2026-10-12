import {beforeEach, describe, expect, it, vi} from "vitest";

import type {SubmitResult} from "@/core/preview/request";
import {submitResult} from "@/core/preview/response";
import type {DcinsideDccon, GalleryPreData, PostInfo} from "@/core/preview/types";
import {isCommentPosted, postComment} from "@/features/preview/comment-submit";

const net = vi.hoisted(() => ({
    responses: [] as string[],
    tokens: [] as (string | undefined)[],
    token: "token" as string | undefined
}));

vi.mock("@/core/preview/request", async (importOriginal) => {
    const {submitResult} = await import("@/core/preview/response");
    const send = async (...args: unknown[]): Promise<SubmitResult> => {
        net.tokens.push(args.at(-1) as string | undefined);
        return submitResult(net.responses.shift() ?? "");
    };
    return {...await importOriginal<typeof import("@/core/preview/request")>(), submitComment: send, submitTxtcon: send};
});

vi.mock("@/core/messaging/protocol", () => ({sendMessage: async () => net.token}));

const preData = {gallery: "test", id: "1"} as GalleryPreData;
const post = {} as PostInfo;
const user = {name: "ㅇㅇ", pw: "1234"};
const reply = {commentNo: null, replyNo: null};
const text = {text: "댓글", dccons: [], bigDccon: false};
const dccon = {...text, dccons: [{package_idx: "1", detail_idx: "2", list_img: "", title: "콘"}] satisfies DcinsideDccon[]};
const txtcon = {...text, txtcon: {bg: "1", txt: "2"}};

const send = (responses: string[], content: Parameters<typeof postComment>[3] = text) => {
    net.responses = responses;
    return postComment(preData, post, user, content, reply);
};

beforeEach(() => {
    net.tokens = [];
    net.token = "token";
});

describe("isCommentPosted", () => {
    it("새 댓글 번호는 성공으로 본다", () => {
        expect(isCommentPosted(submitResult("12345"))).toBe(true);
    });

    it("false·빈 응답·HTML 페이지·실패 코드는 실패로 본다", () => {
        for (const response of ["false||메시지", "", "  <html><body>로그인</body></html>", "code_fail", "fail1", "form_error", "not_buy", "fail"]) {
            expect(isCommentPosted(submitResult(response)), response).toBe(false);
        }
    });
});

describe("postComment", () => {
    it("글 댓글은 새 댓글 번호면 성공이다", async () => {
        expect(await send(["12345"])).toEqual({ok: true});
        expect(net.tokens).toEqual([undefined]);
    });

    it("디시 문구가 있는 실패는 그 문구를, 실패 코드는 우리 문구를 보인다", async () => {
        expect(await send(["false||도배는 안 됩니다."])).toEqual({ok: false, captcha: false, message: "도배는 안 됩니다."});
        expect(await send(["false||nomember||회원만 쓸 수 있습니다."])).toEqual({ok: false, captcha: false, message: "회원만 쓸 수 있습니다."});
        expect(await send(["code_fail"])).toEqual({ok: false, captcha: false, message: "자동입력 방지 코드가 일치하지 않습니다."});
        expect(await send(["<html></html>"])).toEqual({ok: false, captcha: false, message: "댓글을 작성하지 못했습니다."});
    });

    it("v3 캡차를 요구하면 토큰을 붙여 한 번 더 보낸다", async () => {
        expect(await send(["false||captcha||v3", "12345"])).toEqual({ok: true});
        expect(net.tokens).toEqual([undefined, "token"]);
    });

    it("토큰을 받지 못했거나 다시 보내도 캡차면 원문에서 풀게 한다", async () => {
        net.token = undefined;
        expect(await send(["false||captcha||v3"])).toEqual({ok: false, captcha: true});
        expect(net.tokens).toEqual([undefined]);

        net.token = "token";
        expect(await send(["false||captcha||v3", "false||captcha"])).toEqual({ok: false, captcha: true});
    });

    it("디시콘·글자콘은 ok만 성공이다", async () => {
        expect(await send(["ok"], dccon)).toEqual({ok: true});
        expect(await send(["ok"], txtcon)).toEqual({ok: true});
        // 댓글 번호처럼 보여도 디시콘 응답이면 성공이 아니다.
        expect((await send(["12345"], dccon)).ok).toBe(false);
    });

    it("디시콘 실패 코드는 디시콘 댓글에서만 디시콘 문구를 보인다", async () => {
        expect(await send(["not_buy"], dccon)).toEqual({ok: false, captcha: false, message: "구매내역이 존재하지 않는 디시콘입니다."});
        expect(await send(["fail"], txtcon)).toEqual({ok: false, captcha: false, message: "댓글을 작성하지 못했습니다."});
    });
});
