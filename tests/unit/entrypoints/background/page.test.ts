import {afterEach, describe, expect, it, vi} from "vitest";

import {listenPageMessages} from "@/entrypoints/background/page";

type Sender = Browser.runtime.MessageSender;
type Handler = (message: { data: string; sender: Sender }) => Promise<void>;

const onMessage = vi.hoisted(() => vi.fn<(type: string, handler: Handler) => void>());
vi.mock("@/core/messaging/protocol", () => ({onMessage}));
const runInPage = vi.hoisted(() => vi.fn<(sender: Sender, func: (gallery: string) => void, args: [string]) => Promise<unknown[]>>());
vi.mock("@/core/module/background", async (importOriginal) => ({...await importOriginal<typeof import("@/core/module/background")>(), runInPage}));

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
});

/** 목록을 바꿨다는 메시지를 받고 배경이 페이지에서 실행하라고 넘긴 함수를 그 인자로 이 문서에서 부른다. */
const replaceList = async (gallery: string, sender: Sender = {tab: {id: 3}} as Sender): Promise<void> => {
    runInPage.mockResolvedValue([]);
    listenPageMessages();
    const handler = onMessage.mock.calls.find(([type]) => type === "refresher:listReplaced")?.[1];
    expect(handler).toBeDefined();
    await handler!({data: gallery, sender});
    for (const [, func, args] of runInPage.mock.calls) func(...args);
};

const inlineScript = (text: string) => document.body.append(Object.assign(document.createElement("script"), {type: "text/x-test", textContent: text}));

describe("refresher:listReplaced", () => {
    it("디시가 페이지를 열 때 chk_user_block에 넘긴 값으로 자체 차단을 다시 걸고 메모 배지를 다시 그린다", async () => {
        const chkUserBlock = vi.fn<(id: string) => void>();
        const renderWriterMemoBadges = vi.fn<(wrapper: null) => void>();
        vi.stubGlobal("chk_user_block", chkUserBlock);
        vi.stubGlobal("UserMemo", {renderWriterMemoBadges});
        inlineScript("var a = 1;");
        inlineScript("$(function () { chk_user_block('mi$mini'); });");

        await replaceList("mini");

        expect(chkUserBlock.mock.calls).toEqual([["mi$mini"]]);
        expect(renderWriterMemoBadges.mock.calls).toEqual([[null]]);
    });

    it("넘긴 값을 찾지 못하면 갤러리 id로 건다", async () => {
        const chkUserBlock = vi.fn<(id: string) => void>();
        vi.stubGlobal("chk_user_block", chkUserBlock);

        await replaceList("a");

        expect(chkUserBlock.mock.calls).toEqual([["a"]]);
    });

    it("디시 함수가 없는 페이지에서는 아무것도 하지 않는다", async () => {
        vi.stubGlobal("UserMemo", {});
        await expect(replaceList("a")).resolves.toBeUndefined();
    });

    it("탭이 없으면 실행하지 않고, 주입이 실패해도 던지지 않는다", async () => {
        await replaceList("a", {});
        expect(runInPage).not.toHaveBeenCalled();

        runInPage.mockRejectedValue(new Error("Cannot access contents of the page"));
        listenPageMessages();
        await expect(onMessage.mock.calls.at(-1)![1]({data: "a", sender: {tab: {id: 3}} as Sender})).resolves.toBeUndefined();
    });
});
