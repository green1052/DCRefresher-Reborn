import ky from "ky";
import {expect, it, vi} from "vitest";

import searchBackground from "@/features/search/background";

type Handler = (message: { data: string }) => Promise<string | null>;

const onMessage = vi.hoisted(() => vi.fn<(type: string, handler: Handler) => void>());
vi.mock("@/core/messaging/protocol", () => ({onMessage}));
const get = vi.hoisted(() => vi.fn<(url: string) => { text: () => Promise<string> }>());
vi.mock("@/core/http/client", () => ({http: {get}}));

/** 갤로그가 status로 답한다. 요청은 나가지 않는다. */
const respond = (status: number, body = "") =>
    get.mockImplementation((url) => ({text: () => ky.get(url, {fetch: async () => new Response(body, {status}), retry: 0}).text()}));

it("없는 아이디(404)면 null을 돌려주고, 다른 오류는 던진다", async () => {
    searchBackground.listen?.();
    const handler = onMessage.mock.calls.find(([type]) => type === "refresher:gallogPage")![1];

    respond(200, "<span class=\"nick_name\">닉</span>");
    await expect(handler({data: "a"})).resolves.toContain("nick_name");
    respond(404);
    await expect(handler({data: "a"})).resolves.toBeNull();
    respond(500);
    await expect(handler({data: "a"})).rejects.toThrow();
});
