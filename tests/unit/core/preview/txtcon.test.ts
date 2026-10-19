import {describe, expect, it} from "vitest";

import {normalizeTxtcon, wrapTxtcon} from "@/core/preview/txtcon";

describe("wrapTxtcon", () => {
    it("직접 넣은 줄바꿈은 두고 줄마다 5글자씩 나눈다", () => {
        expect(wrapTxtcon("가나다라마바")).toBe("가나다라마\n바");
        expect(wrapTxtcon("가\r\n나다라마바사")).toBe("가\n나다라마바\n사");
    });

    it("국기·ZWJ 가족 이모지는 한 글자로 센다", () => {
        expect(wrapTxtcon("🇰🇷👨‍👩‍👧가나다라")).toBe("🇰🇷👨‍👩‍👧가나다\n라");
    });
});

describe("normalizeTxtcon", () => {
    it("4줄까지만 남긴다", () => {
        expect(normalizeTxtcon("1\n2\n3\n4\n5")).toBe("1\n2\n3\n4");
    });

    it("5글자씩 나눠 4줄을 넘으면 뒤를 뺀다", () => {
        expect(normalizeTxtcon("가나다라마바사아자차카타파하거너더러머버서")).toBe("가나다라마바사아자차카타파하거너더러머버");
        expect(normalizeTxtcon("가\n나\n다\n라마바사아자")).toBe("가\n나\n다\n라마바사아");
    });

    it("20자를 넘으면 앞에서부터 채운 데까지만 남기고, BMP 컬러 이모지는 2자로 센다", () => {
        expect(normalizeTxtcon("가나다\n".repeat(7))).toBe("가나다\n가나다\n가나다\n가나다");
        // ⌚은 컬러로 그려지는 BMP 문자라 2자로 센다. ☺는 글자로 그려져 1자다.
        expect(normalizeTxtcon("⌚".repeat(11))).toBe("⌚".repeat(10));
        expect(normalizeTxtcon("☺".repeat(11))).toBe("☺".repeat(11));
    });

    it("국기·ZWJ 이모지는 쪼개지 않는다", () => {
        expect(normalizeTxtcon("🇰🇷👨‍👩‍👧")).toBe("🇰🇷👨‍👩‍👧");
    });

    it("중괄호·안 보이는 채움 문자를 빼고, 특수 공백은 일반 공백으로, 마침표 4개 이상은 3개로 바꾼다", () => {
        expect(normalizeTxtcon("{가}ㅤ나")).toBe("가나");
        expect(normalizeTxtcon("가 나")).toBe("가 나");
        expect(normalizeTxtcon("아.....")).toBe("아...");
    });

    it("이모지 구간 밖의 4바이트 문자는 +로 바꾼다", () => {
        expect(normalizeTxtcon("𝐀")).toBe("+");
    });

    it("아주 긴 붙여넣기도 바로 자른다", () => {
        expect(normalizeTxtcon("ㅋ".repeat(100_000))).toBe("ㅋ".repeat(20));
    });
});
