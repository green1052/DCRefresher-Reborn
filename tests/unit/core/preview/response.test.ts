import {afterEach, describe, expect, it, vi} from "vitest";

import {dcBody, resultMessage, submitResult} from "@/core/preview/response";

afterEach(() => void vi.unstubAllGlobals());

describe("submitResult", () => {
    it("result||message||detail로 나눈다", () => {
        expect(submitResult(" false||captcha||v3\n")).toEqual({result: "false", message: "captcha", detail: "v3"});
    });

    it("칸이 하나면 message·detail이 없다", () => {
        expect(submitResult("12345")).toEqual({result: "12345", message: undefined, detail: undefined});
    });

    it("빈 응답은 빈 result다", () => {
        expect(submitResult("").result).toBe("");
    });
});

describe("resultMessage", () => {
    it("두 번째 칸이 문구다", () => {
        expect(resultMessage(submitResult("false||글이 없습니다."))).toBe("글이 없습니다.");
    });

    it("nomember면 세 번째 칸이 문구다", () => {
        expect(resultMessage(submitResult("false||nomember||회원만 쓸 수 있습니다."))).toBe("회원만 쓸 수 있습니다.");
    });

    it("문구가 비면 undefined다", () => {
        expect(resultMessage(submitResult("false||"))).toBeUndefined();
        expect(resultMessage(submitResult("false"))).toBeUndefined();
    });
});

describe("dcBody", () => {
    it("CSRF 토큰·갤러리 종류를 앞에 두고 필드를 잇는다", async () => {
        vi.stubGlobal("cookieStore", {get: async (name: string) => (name === "ci_c" ? {value: "tok"} : null)});
        const body = await dcBody("https://gall.dcinside.com/mgallery/board/view/?id=a&no=1", {id: "a", skip: undefined, empty: ""});
        expect([...body]).toEqual([["ci_t", "tok"], ["_GALLTYPE_", "M"], ["id", "a"], ["empty", ""]]);
    });

    it("갤러리 주소마다 _GALLTYPE_이 다르다", async () => {
        const galltype = async (link: string) => (await dcBody(link, {})).get("_GALLTYPE_");
        expect(await galltype("https://gall.dcinside.com/board/view/?id=a&no=1")).toBe("G");
        expect(await galltype("https://gall.dcinside.com/mini/board/view/?id=a&no=1")).toBe("MI");
        expect(await galltype("https://gall.dcinside.com/person/board/view/?id=a&no=1")).toBe("PR");
    });
});
