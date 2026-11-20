import {describe, expect, it, vi} from "vitest";

import {getGallogActivity, getGallogActivityUnlessBusy, onGallogActivity} from "@/core/gallog";

// 갤로그 응답은 uid별 표로 둔다 ("글,댓글" 텍스트).
const replies = vi.hoisted(() => new Map<string, string>());
vi.mock("@/core/http/client", () => ({
    ajax: {post: (_url: string, {body}: { body: URLSearchParams }) => ({text: async () => replies.get(body.get("user_id") ?? "") ?? "error"})}
}));
vi.mock("@/core/http/cookie", () => ({csrfBody: async (fields: Record<string, string>) => new URLSearchParams(fields)}));
// 배경과 통신은 기본으로 "이 탭이 받는다". 공유 경로는 각 테스트에서 mockResolvedValueOnce로 정한다.
const sendMessage = vi.hoisted(() => vi.fn(async (): Promise<{mine: boolean; cached?: {article: number; comment: number}}> => ({mine: true})));
vi.mock("@/core/messaging/protocol", () => ({sendMessage}));

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

describe("탭 사이 공유", () => {
    it("배경 공유 캐시 값이 오면 요청하지 않고 그 값으로 알린다", async () => {
        sendMessage.mockResolvedValueOnce({mine: false, cached: {article: 7, comment: 8}});
        const heard = vi.fn();
        const stop = onGallogActivity(heard);

        await expect(getGallogActivity("s")).resolves.toEqual({article: 7, comment: 8});
        expect(heard).toHaveBeenCalledExactlyOnceWith("s", {article: 7, comment: 8});
        stop();
    });

    it("다른 탭이 받는 중이면 자동 조회는 요청하지 않고 null", async () => {
        sendMessage.mockResolvedValueOnce({mine: false});
        await expect(getGallogActivityUnlessBusy("t")).resolves.toBeNull();
    });

    it("조회권을 얻으면 받아 배경에 나눠준다", async () => {
        replies.set("u", "9,9");
        await expect(getGallogActivityUnlessBusy("u")).resolves.toEqual({article: 9, comment: 9});
        expect(sendMessage.mock.calls.at(-1)).toEqual(["refresher:gallogResult", {uid: "u", activity: {article: 9, comment: 9}}]);
    });
});
