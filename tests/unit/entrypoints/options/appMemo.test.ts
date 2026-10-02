import {describe, expect, it} from "vitest";

import {formatAppMemos, parseAppMemos} from "@/entrypoints/options/appMemo";

describe("parseAppMemos", () => {
    it("아이디-메모 줄을 나누고 IP 모양은 IP 메모로, 형식이 아닌 줄은 센다", () => {
        const {memos, skipped} = parseAppMemos("user1-메모 하나\n\n123.45-유동-메모\n형식아님\n-빈대상\nuser2-\r\n");
        expect(memos.UID).toStrictEqual({user1: "메모 하나"});
        expect(memos.IP).toEqual({"123.45": "유동-메모"});
        expect(skipped).toBe(3);
    });
});

describe("formatAppMemos", () => {
    it("아이디·IP 메모만 한 줄씩 만들고 닉네임 메모는 뺀 개수를 센다", () => {
        const {text, count, skipped} = formatAppMemos({
            UID: {u: {text: "여러\n줄", color: ""}},
            IP: {"1.2": {text: "ip", color: ""}},
            NICK: {n: {text: "x", color: ""}}
        });
        expect(text).toBe("u-여러 줄\n1.2-ip");
        expect(count).toBe(2);
        expect(skipped).toBe(1);
    });
});
