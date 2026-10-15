import {afterEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import background from "@/features/preview/background";

type Sender = Browser.runtime.MessageSender;
type Data = { action: "comment_submit" | "comment_delete_submit"; rcKey: "new" | "new3" } | { action: "insert_icon" };
type Handler = (message: { data: Data; sender: Sender }) => Promise<string | undefined>;

const onMessage = vi.hoisted(() => vi.fn<(type: string, handler: Handler) => void>());
vi.mock("@/core/messaging/protocol", () => ({onMessage}));
type Execute = (siteKey: string, action: string) => Promise<string>;
const runInPage = vi.hoisted(() => vi.fn<(sender: Sender, func: Execute, args: [string, string]) => Promise<{ result?: unknown }[]>>());
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

describe("페이지에서 토큰 받기", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.head.replaceChildren();
        document.body.replaceChildren();
    });

    /** 배경이 페이지에서 실행하라고 넘긴 함수를 그 인자로 이 문서에서 부른다. */
    const execute = async (data: Data): Promise<string> => {
        runInPage.mockResolvedValue([]);
        await receive(data);
        const [, func, args] = runInPage.mock.calls.at(-1)!;
        return func(...args);
    };

    /** api.js가 loadedKey로 떠 있는 grecaptcha. 디시처럼 다른 키 문자열로 execute하면 던지고, 그린 위젯 번호로는 토큰을 준다. */
    const stubGrecaptcha = (loadedKey: string) => {
        const widgets: string[] = [];
        const grecaptcha = {
            ready: vi.fn((callback: () => void) => callback()),
            render: vi.fn((_container: HTMLElement, parameters: { sitekey: string; size: "invisible" }) => widgets.push(parameters.sitekey) - 1),
            execute: vi.fn(async (key: string | number, options: { action: string }) => {
                const siteKey = typeof key === "number" ? widgets[key] : key;
                if (typeof key === "string" && key !== loadedKey) throw new Error(`Invalid site key or not loaded in api.js: ${key}`);
                return `${siteKey}:${options.action}`;
            })
        };
        vi.stubGlobal("grecaptcha", grecaptcha);
        vi.stubGlobal("refresherRecaptchaWidgets", undefined);
        return grecaptcha;
    };

    const NEW = "6LfrAuMtAAAAABXdEPC0ZSItQjLjlt2lC4jo3VNX";
    const ICON = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";

    it("api.js가 같은 키로 떠 있으면 그 키로 바로 실행한다", async () => {
        const grecaptcha = stubGrecaptcha(NEW);
        await expect(execute({action: "comment_submit", rcKey: "new"})).resolves.toBe(`${NEW}:comment_submit`);
        expect(grecaptcha.render).not.toHaveBeenCalled();
    });

    it("다른 키로 떠 있으면 보이지 않는 위젯을 키마다 한 번만 그려 다시 쓴다", async () => {
        const grecaptcha = stubGrecaptcha(NEW);

        await expect(execute({action: "insert_icon"})).resolves.toBe(`${ICON}:insert_icon`);
        await expect(execute({action: "insert_icon"})).resolves.toBe(`${ICON}:insert_icon`);
        await expect(execute({action: "comment_submit", rcKey: "new3"})).resolves.toBe("6LcjA-MtAAAAAIdgo8TKvID6HS34Ac9AkzRjuJfY:comment_submit");

        expect(grecaptcha.render.mock.calls.map(([, parameters]) => parameters)).toEqual([
            {sitekey: ICON, size: "invisible"},
            {sitekey: "6LcjA-MtAAAAAIdgo8TKvID6HS34Ac9AkzRjuJfY", size: "invisible"}
        ]);
        expect(document.body.childElementCount).toBe(2);
    });

    it("api.js가 없으면 이 키로 불러온 뒤 실행한다", async () => {
        vi.stubGlobal("grecaptcha", undefined);
        const token = execute({action: "insert_icon"});

        await vi.waitFor(() => expect(document.head.querySelector("script")).not.toBeNull());
        const script = document.head.querySelector("script")!;
        expect(script.src).toBe(`https://www.google.com/recaptcha/api.js?render=${ICON}`);
        stubGrecaptcha(ICON);
        script.dispatchEvent(new Event("load"));

        await expect(token).resolves.toBe(`${ICON}:insert_icon`);
    });
});

it("페이지가 15초 안에 토큰을 주지 않으면 토큰 없이 돌려준다", async () => {
    vi.useFakeTimers();
    runInPage.mockReturnValue(new Promise(() => {}));
    const token = receive({action: "insert_icon"});
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(token).resolves.toBeUndefined();
    vi.useRealTimers();
});

it("설치·업데이트 때 예전 읽은 글 기록을 지운다", async () => {
    await fakeBrowser.storage.local.set({"refresher:module:preview:data": [1]});
    background.listen?.();

    await fakeBrowser.runtime.onInstalled.trigger({reason: "update", previousVersion: "6.1.1"});
    await vi.waitFor(async () => expect(await fakeBrowser.storage.local.get("refresher:module:preview:data")).toEqual({}));
});
