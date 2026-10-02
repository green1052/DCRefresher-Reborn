import {describe, expect, it, vi} from "vitest";

// client.ts는 모듈을 읽는 순간 fetch를 잡아 두므로 가짜를 먼저 박는다.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const {BlockedError, formBody, http, isAbortError, setBlockedHandler} = await import("@/core/http/client");

const page = (body: string): Response => new Response(body, {status: 200});

describe("임시 차단 검사", () => {
    it("디시 GET이 빈 문서면 BlockedError를 던지고 알림을 부른다", async () => {
        fetchMock.mockResolvedValue(page("<html><body>\n </body></html>"));
        const onBlocked = vi.fn();
        setBlockedHandler(onBlocked);

        const error = await http.get("https://gall.dcinside.com/board/view/?id=a&no=1").text().catch((e: unknown) => e);
        expect(error).toBeInstanceOf(BlockedError);
        expect(onBlocked).toHaveBeenCalled();
    });

    it("본문이 있거나 디시가 아니거나 검사 대상 요청이 아니면 그냥 지나간다", async () => {
        // 본문 있는 디시 GET.
        fetchMock.mockResolvedValue(page("<html><body><p>글</p></body></html>"));
        await expect(http.get("https://gall.dcinside.com/board/view/?id=a").text()).resolves.toContain("글");

        // 디시가 아닌 빈 GET.
        fetchMock.mockResolvedValue(page(""));
        await expect(http.get("https://example.com/").text()).resolves.toBe("");

        // 디시 빈 POST지만 /board/comment/ 아래가 아니다.
        fetchMock.mockResolvedValue(page(""));
        await expect(http.post("https://gall.dcinside.com/ajax/abc", {body: new URLSearchParams()}).text()).resolves.toBe("");
    });
});

describe("formBody", () => {
    it("null·undefined·false는 빼고 빈 문자열은 넣는다", () => {
        expect(formBody({a: "1", b: null, c: undefined, d: false, e: ""}).toString()).toBe("a=1&e=");
    });
});

describe("isAbortError", () => {
    it("이름으로만 본다 (파이어폭스 content.fetch의 오류는 영역 객체가 다르다)", () => {
        expect(isAbortError({name: "AbortError"})).toBe(true);
        expect(isAbortError(new Error("x"))).toBe(false);
        expect(isAbortError(null)).toBe(false);
    });
});
