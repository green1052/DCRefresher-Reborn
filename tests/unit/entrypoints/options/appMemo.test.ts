import {describe, expect, it} from "vitest";

import {formatAppMemos, parseAppMemos} from "@/entrypoints/options/appMemo";
import {dcconImage} from "@/entrypoints/options/BlockTab";

describe("parseAppMemos", () => {
    it("첫 '-'에서만 나누고, 앞 두 자리 IP면 IP 메모다", () => {
        expect(parseAppMemos("user1-친구 - 고닉\r\n123.45-유동\n1.2.3-아이디")).toEqual({
            memos: {UID: {user1: "친구 - 고닉", "1.2.3": "아이디"}, IP: {"123.45": "유동"}},
            skipped: 0
        });
    });

    it("빈 줄은 건너뛰고, '-'가 없거나 대상·메모가 빈 줄은 센다", () => {
        expect(parseAppMemos("\n  \nuser1\n-메모\nuser2- \nuser3-메모")).toEqual({memos: {UID: {user3: "메모"}, IP: {}}, skipped: 3});
    });

    it("아이디가 __proto__여도 조용히 사라지지 않는다", () => {
        const {memos} = parseAppMemos("__proto__-메모");
        expect(Object.hasOwn(memos.UID, "__proto__")).toBe(true);
        expect(memos.UID["__proto__"]).toBe("메모");
    });
});

describe("formatAppMemos", () => {
    it("아이디·IP 메모를 한 줄씩 쓰고 줄바꿈은 공백으로, 닉네임 메모는 빼고 센다", () => {
        const memos = {
            UID: {user1: {text: "첫 줄\n 둘째 줄", color: "#000"}},
            IP: {"123.45": {text: "유동", color: "#000"}},
            NICK: {닉: {text: "닉 메모", color: "#000"}}
        };
        const formatted = formatAppMemos(memos);
        expect(formatted).toEqual({text: "user1-첫 줄 둘째 줄\n123.45-유동", count: 2, skipped: 1});
        expect(parseAppMemos(formatted.text).memos).toEqual({UID: {user1: "첫 줄 둘째 줄"}, IP: {"123.45": "유동"}});
    });
});

describe("dcconImage", () => {
    const image = (no: string): string => `https://image.dcinside.com/dccon.php?no=${no}`;

    it("코드 하나면 그 코드의 이미지다", () => {
        expect(dcconImage({id: "a", content: "abc123", isRegex: false})).toBe(image("abc123"));
    });

    // stores/blockRequest.ts가 묶음을 "^(" + RegExp.escape로 묶은 경로들 + ")$"로 저장한다.
    it("묶음 정규식이면 RegExp.escape를 되돌린 첫 코드의 이미지다", () => {
        const bundle = (paths: string[]): string => `^(${paths.map((path) => RegExp.escape(path)).join("|")})$`;
        expect(dcconImage({id: "a", content: bundle(["6abc", "7def"]), isRegex: true})).toBe(image("6abc"));
        expect(dcconImage({id: "a", content: bundle(["abc"]), isRegex: true})).toBe(image("abc"));
    });
});
