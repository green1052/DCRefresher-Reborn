import {describe, expect, it, vi} from "vitest";

import {csrfBody} from "@/core/http/cookie";

describe("csrfBody", () => {
    it("ci_c 쿠키를 ci_t로 맨 앞에 붙인다", async () => {
        const get = vi.spyOn(cookieStore, "get").mockResolvedValue({name: "ci_c", value: "token"});
        const body = await csrfBody({id: "test", no: undefined, empty: ""});
        expect(get).toHaveBeenCalledWith("ci_c");
        expect(body.toString()).toBe("ci_t=token&id=test&empty=");
    });

    it("쿠키가 없으면 빈 토큰을 보낸다", async () => {
        expect((await csrfBody({id: "test"})).toString()).toBe("ci_t=&id=test");
    });
});
