import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {listenPageMessages} from "@/entrypoints/background/page";

type Sender = { tab?: { id?: number }; frameId?: number; documentId?: string };
type Handler = (message: { data: unknown; sender: Sender }) => unknown;

const {handlers} = vi.hoisted(() => ({handlers: new Map<string, Handler>()}));

vi.mock("@/core/messaging/protocol", () => ({onMessage: (type: string, handler: Handler) => void handlers.set(type, handler)}));
vi.mock("@/features/write/images", () => ({UPLOAD_OPTIONS_KEY: "uploadKey", hookUploads: () => {}}));

const send = (type: string, data: unknown, sender: Sender = {tab: {id: 3}, frameId: 2}) =>
    handlers.get(type)!({data, sender});

/** executeScript를 페이지 대신 jsdom에서 그대로 돌린다. */
const runHere = () => vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation(async (injection) => {
    if (!("func" in injection) || !injection.func) return [];
    return [{frameId: 0, documentId: "", result: await injection.func(...("args" in injection ? injection.args ?? [] : []))}];
});

beforeEach(() => listenPageMessages());
afterEach(() => {
    for (const key of ["grecaptcha", "chk_user_block", "UserMemo"]) Reflect.deleteProperty(window, key);
    document.head.innerHTML = "";
});

describe("refresher:grecaptchaToken", () => {
    it("보낸 문서의 페이지에서 토큰을 받는다", async () => {
        const execute = vi.fn(async () => "token");
        Object.assign(window, {grecaptcha: {ready: (callback: () => void) => callback(), execute}});
        const executeScript = runHere();

        expect(await send("refresher:grecaptchaToken", "comment", {tab: {id: 3}, documentId: "doc"})).toBe("token");

        expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({target: {tabId: 3, documentIds: ["doc"]}, world: "MAIN"}));
        expect(execute).toHaveBeenCalledWith(expect.any(String), {action: "comment"});
    });

    it("documentId가 없으면 프레임 번호로 집는다", async () => {
        const executeScript = vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation(async () => []);

        expect(await send("refresher:grecaptchaToken", "comment")).toBeUndefined();

        expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({target: {tabId: 3, frameIds: [2]}}));
    });

    it("탭이 아닌 곳에서 오거나 실패하면 undefined", async () => {
        const executeScript = vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation(async () => {
            throw new Error("closed");
        });

        expect(await send("refresher:grecaptchaToken", "comment", {})).toBeUndefined();
        expect(executeScript).not.toHaveBeenCalled();
        expect(await send("refresher:grecaptchaToken", "comment")).toBeUndefined();
    });

    it("api.js가 끝나지 않으면 15초 뒤 포기한다", async () => {
        vi.useFakeTimers();
        vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation(() => new Promise(() => {}));

        const token = send("refresher:grecaptchaToken", "comment");
        await vi.advanceTimersByTimeAsync(15_000);

        expect(await token).toBeUndefined();
    });

    it("grecaptcha가 없으면 api.js를 넣어 불러온다", async () => {
        runHere();
        const token = send("refresher:grecaptchaToken", "comment");
        const script = await vi.waitFor(() => document.head.querySelector("script")!);
        expect(script.src).toMatch(/^https:\/\/www\.google\.com\/recaptcha\/api\.js\?render=/);

        Object.assign(window, {grecaptcha: {ready: (callback: () => void) => callback(), execute: async () => "loaded"}});
        script.dispatchEvent(new Event("load"));

        expect(await token).toBe("loaded");
    });
});

describe("refresher:listReplaced", () => {
    it("페이지가 열 때 넘긴 갤러리 값으로 자체 차단·메모 배지를 다시 건다", async () => {
        const block = vi.fn();
        const badges = vi.fn();
        Object.assign(window, {chk_user_block: block, UserMemo: {renderWriterMemoBadges: badges}});
        document.head.innerHTML = "<script>/* x */</script><script>chk_user_block('mi$mini')</script>";
        runHere();

        await send("refresher:listReplaced", "mini");

        expect(block).toHaveBeenCalledWith("mi$mini");
        expect(badges).toHaveBeenCalledWith(null);
    });

    it("넘긴 값이 없으면 갤러리 id를 쓰고, 함수가 없으면 건너뛴다", async () => {
        const block = vi.fn();
        Object.assign(window, {chk_user_block: block});
        runHere();

        await send("refresher:listReplaced", "g");

        expect(block).toHaveBeenCalledWith("g");
    });

    it("주입이 실패해도 던지지 않는다", async () => {
        vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation(async () => {
            throw new Error("gone");
        });
        await expect(send("refresher:listReplaced", "g")).resolves.toBeUndefined();
    });
});

describe("refresher:hookUploads", () => {
    it("업로드 설정 키로 hookUploads를 넣는다", async () => {
        const executeScript = vi.spyOn(fakeBrowser.scripting, "executeScript").mockImplementation(async () => []);

        await send("refresher:hookUploads", undefined);
        await send("refresher:hookUploads", undefined, {});

        expect(executeScript).toHaveBeenCalledTimes(1);
        expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({args: ["uploadKey"], world: "MAIN"}));
    });
});
