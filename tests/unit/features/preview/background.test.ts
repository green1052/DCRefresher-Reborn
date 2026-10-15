// @vitest-environment node
import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import background from "@/features/preview/background";

type Sender = Browser.runtime.MessageSender;
type Data = { action: "comment_submit" | "comment_delete_submit"; rcKey: "new" | "new3" } | { action: "insert_icon" };
type Handler = (message: { data: Data; sender: Sender }) => Promise<string | undefined>;

const onMessage = vi.hoisted(() => vi.fn<(type: string, handler: Handler) => void>());
vi.mock("@/core/messaging/protocol", () => ({onMessage}));
const runInPage = vi.hoisted(() => vi.fn<(sender: Sender, func: unknown, args: [string, string]) => Promise<{ result?: unknown }[]>>());
vi.mock("@/core/module/background", async (importOriginal) => ({...await importOriginal<typeof import("@/core/module/background")>(), runInPage}));

/** listen이 건 refresher:grecaptchaToken 리스너를 sender가 data를 보낸 것처럼 부른다. */
const receive = (data: Data, sender: Sender = {tab: {id: 3}} as Sender): Promise<string | undefined> => {
    background.listen?.();
    const handler = onMessage.mock.calls.find(([type]) => type === "refresher:grecaptchaToken")?.[1];
    expect(handler).toBeDefined();
    return handler!({data, sender});
};

describe("refresher:grecaptchaToken", () => {
    it("댓글은 rcKey와 같은 쌍의 사이트 키로, 디시콘은 예전 키로 토큰을 받는다", async () => {
        runInPage.mockResolvedValue([{result: "token"}]);

        await expect(receive({action: "comment_submit", rcKey: "new"})).resolves.toBe("token");
        await receive({action: "comment_delete_submit", rcKey: "new3"});
        await receive({action: "insert_icon"});

        expect(runInPage.mock.calls.map(([, , args]) => args)).toEqual([
            ["6LfrAuMtAAAAABXdEPC0ZSItQjLjlt2lC4jo3VNX", "comment_submit"],
            ["6LcjA-MtAAAAAIdgo8TKvID6HS34Ac9AkzRjuJfY", "comment_delete_submit"],
            ["6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI", "insert_icon"]
        ]);
    });

    it("탭이 없거나 주입이 실패하면 토큰 없이 돌려준다", async () => {
        runInPage.mockClear().mockResolvedValue([{result: "token"}]);
        await expect(receive({action: "insert_icon"}, {})).resolves.toBeUndefined();
        expect(runInPage).not.toHaveBeenCalled();

        runInPage.mockRejectedValue(new Error("Cannot access contents of the page"));
        await expect(receive({action: "insert_icon"})).resolves.toBeUndefined();
    });
});

it("설치·업데이트 때 예전 읽은 글 기록을 지운다", async () => {
    await fakeBrowser.storage.local.set({"refresher:module:preview:data": [1]});
    background.listen?.();

    await fakeBrowser.runtime.onInstalled.trigger({reason: "update", previousVersion: "6.1.1"});
    await vi.waitFor(async () => expect(await fakeBrowser.storage.local.get("refresher:module:preview:data")).toEqual({}));
});
