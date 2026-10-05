import {describe, expect, it, vi} from "vitest";

const fetchMock = vi.hoisted(() => (globalThis.fetch = vi.fn<typeof fetch>()));

import {urls} from "@/core/http/urls";
import {graphemes, normalizeTxtcon, submitTxtcon, wrapTxtcon} from "@/core/preview/txtcon";
import type {CommentForm, PostInfo} from "@/core/preview/types";

import {preData} from "../../../helpers";
import {serve} from "./net";

describe("graphemes", () => {
    it("국기·ZWJ 이모지를 한 글자로 센다", () => {
        expect(graphemes("가🇰🇷👨‍👩‍👧")).toEqual(["가", "🇰🇷", "👨‍👩‍👧"]);
    });
});

describe("wrapTxtcon", () => {
    it("줄마다 5글자씩 나누고 넣은 줄바꿈은 둔다", () => {
        expect(wrapTxtcon("가나다라마바사\r\n아자")).toBe("가나다라마\n바사\n아자");
    });

    it("이미 나눈 글은 그대로다", () => {
        const wrapped = wrapTxtcon("가나다라마바사아자차카");
        expect(wrapTxtcon(wrapped)).toBe(wrapped);
    });

    it("이모지는 한 글자로 나눈다", () => {
        expect(wrapTxtcon("🇰🇷🇰🇷🇰🇷🇰🇷🇰🇷🇰🇷")).toBe("🇰🇷🇰🇷🇰🇷🇰🇷🇰🇷\n🇰🇷");
    });
});

describe("normalizeTxtcon", () => {
    it("20자를 넘으면 자른다", () => {
        expect(normalizeTxtcon("가나다라마\n바사아자차\n카타파하가\n나다라마바사")).toBe("가나다라마\n바사아자차\n카타파하가\n나다라마바");
    });

    it("4줄을 넘으면 뒷줄을 버린다", () => {
        expect(normalizeTxtcon("1\n2\n3\n4\n5")).toBe("1\n2\n3\n4");
    });

    it("5글자로 나눈 줄이 넘치면 뒤에서 뺀다", () => {
        // 12글자 줄은 3줄로 나뉘어 넷째 줄은 5글자까지다.
        expect(normalizeTxtcon("가나다라마바사아자차카타\n파하가나다라")).toBe("가나다라마바사아자차카타\n파하가나다");
    });

    it("컬러 이모지는 2글자로 센다", () => {
        expect(normalizeTxtcon("⌚".repeat(11))).toBe("⌚".repeat(10));
    });

    it("넘치는 글자에서 멈춰 뒤 글자를 붙이지 않는다", () => {
        // 19자 뒤의 컬러 이모지(2)는 넘친다. 건너뛰고 이어 가면 이모지에 붙은 결합 기호가 앞의 '1'에 붙는다.
        expect(normalizeTxtcon(`${"1".repeat(19)}⌚́`)).toBe("1".repeat(19));
    });

    it("허용하지 않는 문자를 정리한다", () => {
        expect(normalizeTxtcon("a　b")).toBe("a b");
        expect(normalizeTxtcon("aㅤ⠀b")).toBe("ab");
        expect(normalizeTxtcon("{a}")).toBe("a");
        expect(normalizeTxtcon("a.....")).toBe("a...");
        expect(normalizeTxtcon("𝐀")).toBe("+");
        expect(normalizeTxtcon("﷽")).toBe("+");
        expect(normalizeTxtcon("a\u0007b")).toBe("ab");
    });

    it("이모지 구간의 4바이트 문자는 둔다", () => {
        expect(normalizeTxtcon("😀")).toBe("😀");
    });

    it("결합 기호는 2개까지 둔다", () => {
        expect(normalizeTxtcon("á̂̃̄")).toBe("á̂");
    });

    it("긴 붙여넣기도 빨리 자른다", () => {
        const start = performance.now();
        expect(normalizeTxtcon("가".repeat(100_000))).toBe("가".repeat(20));
        expect(performance.now() - start).toBeLessThan(1000);
    });
});

describe("submitTxtcon", () => {
    const post = (form: Partial<CommentForm> = {}, fields: Partial<PostInfo> = {}): PostInfo => ({
        commentForm: {fields: [], serviceCode: "", checks: {check_6: "a", check_7: "b", check_8: ""}, ...form},
        ...fields
    });

    it("글자콘 값과 폼의 check를 보낸다", async () => {
        const sent = serve(fetchMock, () => "ok");
        const result = await submitTxtcon(preData({gallery: "g", id: "5"}), post({}, {commentId: "cid", commentNo: "55"}), {name: "ㅇㅇ", pw: "pw"}, "안녕", {bg: "333333", txt: "ffffff"}, null, null);
        expect(result.result).toBe("ok");
        expect(sent[0]?.url).toBe(urls.txtcon_submit);
        expect(Object.fromEntries(sent[0]?.body ?? [])).toEqual({
            ci_t: "", _GALLTYPE_: "G", id: "cid", no: "55", txtcon_text: "안녕", txtcon_bg: "333333", txtcon_color: "ffffff",
            name: "ㅇㅇ", password: "pw", check_6: "a", check_7: "b", check_8: "", "g-recaptcha-response": ""
        });
    });

    it("답글·캡차·토큰과 갤닉을 넣는다", async () => {
        const sent = serve(fetchMock, () => "ok");
        await submitTxtcon(preData({gallery: "g", id: "5"}), post({gallNickName: "갤닉"}), {name: ""}, "a", {bg: "ffffff", txt: "333333"}, "1", "2", "cap", "tok");
        expect(Object.fromEntries(sent[0]?.body ?? [])).toMatchObject({
            id: "g", no: "5", c_no: "1", reply_no: "2", code: "cap", "g-recaptcha-token": "tok", gall_nick_name: "갤닉", use_gall_nick: "N"
        });
        expect(sent[0]?.body.has("name")).toBe(false);
    });
});
