import {beforeEach, describe, expect, it, vi} from "vitest";

const fetchMock = vi.hoisted(() => (globalThis.fetch = vi.fn<typeof fetch>()));

import {urls} from "@/core/http/urls";
import type {TurnstileResult} from "@/core/messaging/protocol";
import {submitResult} from "@/core/preview/response";
import type {DcinsideDccon, PostInfo, TurnstileConfig} from "@/core/preview/types";
import {deleteOwnComment, isCommentPosted, postComment, prefetchTurnstile, turnstileFields} from "@/features/preview/comment-submit";

import {preData as makePreData} from "../../../helpers";
import {type Sent, serve} from "../../core/preview/net";

const net = vi.hoisted(() => ({
    requests: [] as unknown[],
    token: "token" as string | undefined,
    turnstile: {token: "ts", state: "ok", tokenMs: 300} as TurnstileResult | undefined
}));

vi.mock("@/core/messaging/protocol", () => ({
    sendMessage: async (type: string, data: unknown) => {
        net.requests.push(data);
        return type === "refresher:turnstileToken" ? net.turnstile : net.token;
    }
}));

const preData = makePreData({gallery: "test", id: "1", link: "https://gall.dcinside.com/board/lists?id=test"});
// dValue는 '5,10'을 디시 알파벳으로 바꾼 base64다. 이게 있어야 submitComment가 service_code를 만들어 보낸다.
const post = {commentForm: {fields: [], serviceCode: "0123456789", dValue: "dTuEQyKK", checks: {}}} satisfies PostInfo;
const user = {name: "ㅇㅇ", pw: "1234"};
const reply = {commentNo: null, replyNo: null};
const text = {text: "댓글", dccons: [], bigDccon: false};
const dccon = {...text, dccons: [{package_idx: "1", detail_idx: "2", list_img: "", title: "콘"}] satisfies DcinsideDccon[]};
const txtcon = {...text, txtcon: {bg: "1", txt: "2"}};

/** 보낸 요청들. 응답은 responses를 차례로 쓴다. */
let sent: Sent[] = [];
const respond = (responses: string[]) => {
    sent = serve(fetchMock, () => responses.shift() ?? "");
};
const field = (name: string) => sent.map(({body}) => body.get(name));

const send = (responses: string[], content: Parameters<typeof postComment>[3] = text) => {
    respond(responses);
    return postComment(preData, post, user, content, reply);
};

beforeEach(() => {
    net.requests = [];
    net.token = "token";
    net.turnstile = {token: "ts", state: "ok", tokenMs: 300};
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
        expect(sent.map(({url}) => url)).toEqual([urls.comments_submit]);
        expect(field("g-recaptcha-token")).toEqual([null]);
    });

    it("디시 문구가 있는 실패는 그 문구를, 실패 코드는 우리 문구를 보인다", async () => {
        expect(await send(["false||도배는 안 됩니다."])).toEqual({ok: false, captcha: false, message: "도배는 안 됩니다."});
        expect(await send(["false||nomember||회원만 쓸 수 있습니다."])).toEqual({ok: false, captcha: false, message: "회원만 쓸 수 있습니다."});
        expect(await send(["code_fail"])).toEqual({ok: false, captcha: false, message: "자동입력 방지 코드가 일치하지 않습니다."});
        expect(await send(["<html></html>"])).toEqual({ok: false, captcha: false, message: "댓글을 작성하지 못했습니다."});
    });

    it("v3 캡차를 요구하면 토큰을 붙여 한 번 더 보낸다", async () => {
        expect(await send(["false||captcha||v3", "12345"])).toEqual({ok: true});
        expect(field("g-recaptcha-token")).toEqual([null, "token"]);
    });

    it("글 댓글은 매번 rc_key를 보내고 재전송 토큰도 그 쌍의 키로 받는다", async () => {
        await send(["false||captcha||v3", "12345"]);
        const [first, second] = field("rc_key");
        expect(["new", "new3"]).toContain(first);
        expect(second).toBe(first);
        expect(field("g-recaptcha-token")).toEqual([null, "token"]);
        expect(net.requests).toEqual([{action: "comment_submit", rcKey: first}]);

        net.requests = [];
        await send(["false||captcha||v3", "ok"], dccon);
        expect(sent.map(({url}) => url)).toEqual([urls.dccon_comments_submit, urls.dccon_comments_submit]);
        expect(field("rc_key")).toEqual([null, null]);
        expect(field("g-recaptcha-token")).toEqual([null, "token"]);
        expect(net.requests).toEqual([{action: "insert_icon"}]);
    });

    it("토큰을 받지 못했거나 다시 보내도 캡차면 원문에서 풀게 한다", async () => {
        net.token = undefined;
        expect(await send(["false||captcha||v3"])).toEqual({ok: false, captcha: true});
        expect(field("g-recaptcha-token")).toEqual([null]);

        net.token = "token";
        expect(await send(["false||captcha||v3", "false||captcha"])).toEqual({ok: false, captcha: true});
    });

    it("디시콘·글자콘은 ok만 성공이다", async () => {
        expect(await send(["ok"], dccon)).toEqual({ok: true});
        expect(await send(["ok"], txtcon)).toEqual({ok: true});
        expect(sent.map(({url}) => url)).toEqual([urls.txtcon_submit]);
        // 댓글 번호처럼 보여도 디시콘 응답이면 성공이 아니다.
        expect((await send(["12345"], dccon)).ok).toBe(false);
    });

    it("디시콘 실패 코드는 디시콘 댓글에서만 디시콘 문구를 보인다", async () => {
        expect(await send(["not_buy"], dccon)).toEqual({ok: false, captcha: false, message: "구매내역이 존재하지 않는 디시콘입니다."});
        expect(await send(["fail"], txtcon)).toEqual({ok: false, captcha: false, message: "댓글을 작성하지 못했습니다."});
    });

    it("Turnstile 칸을 두 전송에 같이 붙인다", async () => {
        const turnstile = {"cf-turnstile-response": "ts", ts_state: "ok"};
        for (const content of [text, dccon, txtcon]) {
            respond(["false||captcha||v3", content === text ? "12345" : "ok"]);
            expect(await postComment(preData, post, user, content, reply, undefined, turnstile)).toEqual({ok: true});
            expect(field("cf-turnstile-response")).toEqual(["ts", "ts"]);
            expect(field("ts_state")).toEqual(["ok", "ok"]);
        }
    });
});

describe("turnstileFields", () => {
    const config = {mode: 2, sitekey: "0xKEY", wait: 20000, test: false};
    const ask = vi.fn<(config: TurnstileConfig) => Promise<TurnstileResult | undefined>>();
    beforeEach(() => ask.mockReset());

    it("보이지 않게 받은 토큰으로 디시 ts_cmt_fields와 같은 칸을 만든다", async () => {
        expect(await turnstileFields(config, 1500, ask)).toEqual({"cf-turnstile-response": "ts", ts_state: "ok", ts_focus_ms: "1500", ts_token_ms: "300"});
        expect(net.requests).toEqual([{config, visible: false}]);
        expect(ask).not.toHaveBeenCalled();
    });

    it("확인을 눌러야 하면 확인 창에서 받고, 창을 닫으면 undefined다", async () => {
        net.turnstile = {token: "", state: "interactive", tokenMs: 0};
        ask.mockResolvedValueOnce({token: "clicked", state: "ok", tokenMs: 5000});
        expect(await turnstileFields(config, 0, ask)).toMatchObject({"cf-turnstile-response": "clicked", ts_state: "ok", ts_token_ms: "5000"});
        expect(ask).toHaveBeenCalledWith(config);

        ask.mockResolvedValueOnce(undefined);
        expect(await turnstileFields(config, 0, ask)).toBeUndefined();
    });

    it("폼에 들어올 때 미리 받은 토큰을 한 번 쓰고, 4분이 지났으면 새로 받는다", async () => {
        prefetchTurnstile(config);
        prefetchTurnstile(config);
        expect((await turnstileFields(config, 0, ask))?.["cf-turnstile-response"]).toBe("ts");
        expect(net.requests).toHaveLength(1);
        await turnstileFields(config, 0, ask);
        expect(net.requests).toHaveLength(2);

        vi.useFakeTimers();
        try {
            prefetchTurnstile(config);
            vi.advanceTimersByTime(240_000);
            await turnstileFields(config, 0, ask);
            expect(net.requests).toHaveLength(4);
        } finally {
            vi.useRealTimers();
        }
    });

    it("토큰을 받지 못해도 상태를 담는다", async () => {
        net.turnstile = {token: "", state: "pending", tokenMs: 0};
        expect(await turnstileFields({...config, test: true}, 0, ask)).toEqual({"cf-turnstile-response": "", ts_state: "pending", ts_focus_ms: "0", ts_token_ms: "0", ts_test: "1"});
        net.turnstile = undefined;
        expect((await turnstileFields(config, 0, ask))?.ts_state).toBe("error");
        expect(ask).not.toHaveBeenCalled();
    });
});

describe("deleteOwnComment", () => {
    it("v3를 요구하면 같은 rc_key 쌍의 토큰을 붙여 한 번 더 보낸다", async () => {
        respond(["false||captcha||v3", "true"]);
        expect(await deleteOwnComment(preData, post, "7", "pw")).toEqual({success: true});
        const rcKey = field("rc_key")[0];
        expect(rcKey).toMatch(/^new3?$/);
        expect(sent.map(({body}) => [body.get("rc_key"), body.get("g-recaptcha-token")])).toEqual([[rcKey, null], [rcKey, "token"]]);
        expect(net.requests).toEqual([{action: "comment_delete_submit", rcKey}]);
    });

    it("재전송도 막히면 원문에서 지우라고 알린다", async () => {
        respond(["false||captcha||v3", "false||captcha"]);
        expect(await deleteOwnComment(preData, post, "7", "pw")).toEqual({success: false, message: "자동입력 방지 확인이 필요합니다. 원문에서 삭제해 주세요."});
    });

    it("비밀번호가 틀리면 디시 문구를 그대로 보인다", async () => {
        respond(["false||비밀번호가 맞지 않습니다."]);
        expect(await deleteOwnComment(preData, post, "7", "x")).toEqual({success: false, message: "비밀번호가 맞지 않습니다."});
        expect(net.requests).toEqual([]);
    });
});
