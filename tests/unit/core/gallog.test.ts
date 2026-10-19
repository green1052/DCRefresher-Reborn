import {describe, expect, it, vi} from "vitest";

import {getGallogActivity, onGallogActivity} from "@/core/gallog";

// 갤로그 응답은 uid별 표로 둔다 ("글,댓글" 텍스트).
const replies = vi.hoisted(() => new Map<string, string>());
vi.mock("@/core/http/client", () => ({
    ajax: {post: (_url: string, {body}: { body: URLSearchParams }) => ({text: async () => replies.get(body.get("user_id") ?? "") ?? "error"})}
}));
vi.mock("@/core/http/cookie", () => ({csrfBody: async (fields: Record<string, string>) => new URLSearchParams(fields)}));

describe("onGallogActivity", () => {
    it("새로 받은 값만 알리고, 캐시에서 꺼낸 값과 실패는 알리지 않는다", async () => {
        replies.set("a", "3,4");
        const heard = vi.fn();
        const stop = onGallogActivity(heard);

        expect(await getGallogActivity("a")).toEqual({article: 3, comment: 4});
        expect(heard).toHaveBeenCalledExactlyOnceWith("a", {article: 3, comment: 4});

        expect(await getGallogActivity("a")).toEqual({article: 3, comment: 4});
        expect(await getGallogActivity("missing")).toBeUndefined();
        expect(heard).toHaveBeenCalledOnce();

        stop();
        replies.set("b", "1,2");
        await getGallogActivity("b");
        expect(heard).toHaveBeenCalledOnce();
    });

    it("듣는 쪽이 던져도 값을 돌려준다", async () => {
        replies.set("c", "5,6");
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const stop = onGallogActivity(() => {
            throw new Error("listener");
        });
        expect(await getGallogActivity("c")).toEqual({article: 5, comment: 6});
        stop();
    });
});
