import {describe, expect, it, vi} from "vitest";

const fetchMock = vi.hoisted(() => (globalThis.fetch = vi.fn<typeof fetch>()));

import {urls} from "@/core/http/urls";
import {submitComment} from "@/core/preview/submit";
import type {DcinsideDccon, PostInfo} from "@/core/preview/types";

import {preData} from "../../../helpers";
import {serve} from "./net";

const R_KEY = "yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBs1Ct2D3uE4Fv5G6wHl78xJ9K";
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

/** 디시 _d()가 섞은 base64로 쓴 값. */
const scramble = (decoded: string): string => Array.from(btoa(decoded), (c) => R_KEY[B64.indexOf(c)]).join("");

/**
 * 풀면 tail이 되는 _d() 값 (submitComment가 푸는 방식의 역). i번째 글자 c는 수 c·(12−i)/2 + i + 1이 되고,
 * 풀 때 첫 자리 f를 f>5면 f−5, 아니면 f+4로 바꾸므로 거꾸로 바꿔 둔다.
 */
const dValueFor = (tail: string): string => {
    const values = Array.from(tail, (c, i) => (c.charCodeAt(0) * (12 - i)) / 2 + i + 1).join(",");
    const first = Number(values[0]);
    return scramble(String(first <= 4 ? first + 5 : first - 4) + values.slice(1));
};

const pre = preData({gallery: "a", id: "7"});
const SERVICE_CODE = "abc0123456789";
const VALID = dValueFor("XYZ!@#0987");

const post = (dValue: string | undefined = VALID): PostInfo => ({
    commentForm: {
        fields: [["service_code", SERVICE_CODE], ["gallery_no", "99"], ["clickbutton", "x"], ["check_6", "keep"], ["name", "폼 이름"]],
        serviceCode: SERVICE_CODE,
        dValue,
        checks: {}
    }
});

const dccon = (detail: string, pkg: string): DcinsideDccon => ({detail_idx: detail, package_idx: pkg, list_img: "", title: ""});

describe("submitComment", () => {
    it("_d() 값으로 service_code 끝 10자를 바꾼다", async () => {
        const sent = serve(fetchMock, () => "1234");
        const result = await submitComment(pre, post(), {name: "ㅇㅇ", pw: "pw12"}, "안녕", null, null, false);
        expect(result.result).toBe("1234");
        expect(sent[0]?.url).toBe(urls.comments_submit);
        expect(sent[0]?.body.get("service_code")).toBe("abcXYZ!@#0987");
    });

    it("폼 필드를 순서대로 보내고 같은 이름은 덮는다", async () => {
        const sent = serve(fetchMock, () => "1");
        await submitComment(pre, post(), {name: "ㅇㅇ", pw: "pw12"}, "안녕", null, null, false);
        const body = sent[0]?.body ?? new URLSearchParams();
        expect(body.has("gallery_no")).toBe(false);
        expect(body.has("clickbutton")).toBe(false);
        expect([...body.keys()].slice(0, 4)).toEqual(["t_vch2", "t_vch2_chk", "check_6", "name"]);
        expect(Object.fromEntries(body)).toMatchObject({
            check_6: "keep", name: "ㅇㅇ", password: "pw12", memo: "안녕", id: "a", no: "7", c_gall_id: "a", c_gall_no: "7", use_gall_nick: "N", "g-recaptcha-response": ""
        });
        for (const key of ["c_no", "reply_no", "code", "g-recaptcha-token", "bigdccon", "input_type"]) expect(body.has(key), key).toBe(false);
    });

    it("답글·캡차·토큰을 넣는다", async () => {
        const sent = serve(fetchMock, () => "1");
        await submitComment(pre, post(), {name: "ㅇㅇ"}, "답", "10", "11", false, "abcd", "tok");
        expect(Object.fromEntries(sent[0]?.body ?? [])).toMatchObject({c_no: "10", reply_no: "11", code: "abcd", "g-recaptcha-token": "tok"});
        expect(sent[0]?.body.has("password")).toBe(false);
    });

    it("디시콘은 디시콘 주소로 번호를 이어 보낸다", async () => {
        const sent = serve(fetchMock, () => "ok");
        await submitComment(pre, post(), {name: "ㅇㅇ"}, [dccon("d1", "p1"), dccon("d2", "p2")], null, null, true);
        expect(sent[0]?.url).toBe(urls.dccon_comments_submit);
        expect(Object.fromEntries(sent[0]?.body ?? [])).toMatchObject({input_type: "comment", double_con_chk: "1", package_idx: "p1,p2", detail_idx: "d1,d2", bigdccon: "1"});
        expect(sent[0]?.body.has("memo")).toBe(false);
    });

    it("디시콘 하나면 double_con_chk가 없다", async () => {
        const sent = serve(fetchMock, () => "ok");
        await submitComment(pre, post(), {name: "ㅇㅇ"}, [dccon("d1", "p1")], null, null, false);
        expect(sent[0]?.body.has("double_con_chk")).toBe(false);
        expect(sent[0]?.body.has("bigdccon")).toBe(false);
    });

    it("_d() 값을 못 풀면 보내지 않는다", async () => {
        serve(fetchMock, () => "1");
        const failed = {result: "false", message: "댓글 폼을 읽지 못했습니다. 원문에서 작성해 주세요."};
        expect(await submitComment(pre, post(""), {name: "ㅇㅇ"}, "x", null, null, false)).toEqual(failed);
        // 숫자가 아닌 값으로 풀리면 틀린 코드를 만들지 않는다.
        expect(await submitComment(pre, post(scramble("a,b")), {name: "ㅇㅇ"}, "x", null, null, false)).toEqual(failed);
        expect(await submitComment(pre, post(scramble("1,x")), {name: "ㅇㅇ"}, "x", null, null, false)).toEqual(failed);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("_d() 값의 개행은 버리고 푼다", async () => {
        const sent = serve(fetchMock, () => "1");
        const value = dValueFor("XYZ!@#0987");
        await submitComment(pre, post(`${value.slice(0, 5)}\n${value.slice(5)}`), {name: "ㅇㅇ"}, "x", null, null, false);
        expect(sent[0]?.body.get("service_code")).toBe("abcXYZ!@#0987");
    });
});
