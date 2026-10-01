import {describe, expect, it} from "vitest";

import {graphemes, normalizeTxtcon, resultMessage, wrapTxtcon} from "@/core/preview/request";

describe("wrapTxtcon", () => {
    it("줄마다 5글자씩 나누고 직접 넣은 줄바꿈은 둔다", () => {
        expect(wrapTxtcon("가나다라마바사")).toBe("가나다라마\n바사");
        expect(wrapTxtcon("가\r\n나다라마바사")).toBe("가\n나다라마바\n사");
        // 결합 이모지는 한 글자.
        expect(graphemes("👨‍👩‍👧a")).toEqual(["👨‍👩‍👧", "a"]);
    });
});

describe("normalizeTxtcon", () => {
    it("4줄·줄당 5자·20자 제한을 적용한다", () => {
        expect(normalizeTxtcon("가나다라마바사아자차카타파하가나다라마바사아")).toBe("가나다라마바사아자차카타파하가나다라마바");
        expect(normalizeTxtcon("1\n2\n3\n4\n5")).toBe("1\n2\n3\n4");
        // 5글자씩 나눈 줄이 4줄을 넘으면 뒤에서 뺀다.
        expect(normalizeTxtcon("가\n나다라마바사아자차카타파하가나다라마바사")).toBe("가\n나다라마바사아자차카타파하가나");
        expect(wrapTxtcon(normalizeTxtcon("가\n나다라마바사아자차카타파하가나다라마바사"))).toBe("가\n나다라마바\n사아자차카\n타파하가나");
    });

    it("허용하지 않는 문자를 정리한다", () => {
        expect(normalizeTxtcon("a{b}c")).toBe("abc");
        expect(normalizeTxtcon("a b　c")).toBe("a b c");
        expect(normalizeTxtcon("a⠀b")).toBe("ab");
        // 이모지 구간 밖 4바이트 문자는 +
        expect(normalizeTxtcon("a𝔸b")).toBe("a+b");
        expect(normalizeTxtcon("😀")).toBe("😀");
        expect(normalizeTxtcon("a.....b")).toBe("a...b");
    });

    it("컬러 이모지는 2글자로 세어 20자 제한에 들어간다", () => {
        expect(normalizeTxtcon("😀".repeat(15))).toBe("😀".repeat(10));
    });
});

describe("resultMessage", () => {
    it("nomember 응답은 세 번째 칸이 문구다", () => {
        expect(resultMessage({result: "false", message: "nomember", detail: "닉네임을 입력해 주세요"})).toBe("닉네임을 입력해 주세요");
        expect(resultMessage({result: "false", message: "권한이 없습니다"})).toBe("권한이 없습니다");
        expect(resultMessage({result: "false", message: ""})).toBeUndefined();
    });
});
