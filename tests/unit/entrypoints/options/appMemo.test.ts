import {describe, expect, it} from "vitest";

import {formatAppMemos, parseAppMemos} from "@/entrypoints/options/appMemo";

const memo = (text: string) => ({text, color: "#000000"});

describe("parseAppMemos", () => {
    it("첫 -에서 나누고 앞 두 자리 IP는 IP 메모다", () => {
        expect(parseAppMemos("user1-착한 사람 - 진짜\r\n123.45-유동\n\n1.2.3-아이디").memos).toEqual({
            UID: {user1: "착한 사람 - 진짜", "1.2.3": "아이디"},
            IP: {"123.45": "유동"}
        });
    });

    it("형식이 아닌 줄은 세고 빈 줄은 세지 않는다", () => {
        const {memos, skipped} = parseAppMemos("no-dash-is-fine\nnodash\n-메모만\n대상만-\n   \n");
        expect(memos.UID).toEqual({no: "dash-is-fine"});
        expect(skipped).toBe(3);
    });
});

describe("formatAppMemos", () => {
    it("아이디·IP 메모만 한 줄씩 쓰고 닉네임 메모 수를 돌려준다", () => {
        const result = formatAppMemos({UID: {u: memo("첫 줄\n  둘째 줄")}, IP: {"1.2": memo("ip")}, NICK: {n: memo("x"), m: memo("y")}});
        expect(result).toEqual({text: "u-첫 줄 둘째 줄\n1.2-ip", count: 2, skipped: 2});
    });

    it("내보낸 글을 다시 읽으면 같다", () => {
        const memos = {UID: {u: memo("a-b")}, IP: {"12.34": memo("c")}, NICK: {}};
        expect(parseAppMemos(formatAppMemos(memos).text)).toEqual({memos: {UID: {u: "a-b"}, IP: {"12.34": "c"}}, skipped: 0});
    });
});
