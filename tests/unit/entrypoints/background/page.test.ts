import {afterEach, describe, expect, it, vi} from "vitest";

import {LIST_REPLACED_EVENT} from "@/core/messaging/protocol";
import {listenPageMessages} from "@/entrypoints/background/page";

type Sender = Browser.runtime.MessageSender;
type Handler = (message: { sender: Sender }) => Promise<void>;

const onMessage = vi.hoisted(() => vi.fn<(type: string, handler: Handler) => void>());
vi.mock("@/core/messaging/protocol", async (importOriginal) => ({...await importOriginal<typeof import("@/core/messaging/protocol")>(), onMessage}));
const runInPage = vi.hoisted(() => vi.fn<(sender: Sender, func: (eventName: string) => void, args: [string]) => Promise<unknown[]>>());
vi.mock("@/core/module/background", async (importOriginal) => ({...await importOriginal<typeof import("@/core/module/background")>(), runInPage}));

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
});

/** 배경이 다리를 걸라는 메시지를 받고 페이지에서 실행하라고 넘긴 함수를 이 문서에서 부른 뒤, 목록을 바꿨다는 이벤트를 보낸다. */
const replaceList = async (gallery: string, sender: Sender = {tab: {id: 3}} as Sender): Promise<void> => {
    runInPage.mockResolvedValue([]);
    listenPageMessages();
    const handler = onMessage.mock.calls.find(([type]) => type === "refresher:installListBridge")?.[1];
    expect(handler).toBeDefined();
    await handler!({sender});
    for (const [, func, args] of runInPage.mock.calls) func(...args);
    document.dispatchEvent(new CustomEvent(LIST_REPLACED_EVENT, {detail: gallery}));
};

const inlineScript = (text: string) => document.body.append(Object.assign(document.createElement("script"), {type: "text/x-test", textContent: text}));

describe("refresher:installListBridge", () => {
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

    it("여러 번 걸어도 리스너는 하나이고, 문자열이 아닌 detail은 무시한다", async () => {
        const chkUserBlock = vi.fn<(id: string) => void>();
        vi.stubGlobal("chk_user_block", chkUserBlock);

        await replaceList("a");
        await replaceList("a");
        document.dispatchEvent(new CustomEvent(LIST_REPLACED_EVENT, {detail: {gallery: "a"}}));

        // 두 번째 replaceList는 앞서 넘긴 함수까지 다시 부르지만 리스너는 처음 하나뿐이다.
        expect(chkUserBlock.mock.calls).toEqual([["a"], ["a"]]);
    });

    it("탭이 없으면 실행하지 않고, 주입이 실패하면 콘텐츠 스크립트가 다시 요청하도록 던진다", async () => {
        runInPage.mockClear();
        await replaceList("a", {});
        expect(runInPage).not.toHaveBeenCalled();

        runInPage.mockRejectedValue(new Error("Cannot access contents of the page"));
        listenPageMessages();
        await expect(onMessage.mock.calls.at(-1)![1]({sender: {tab: {id: 3}} as Sender})).rejects.toThrow("Cannot access");
    });
});
