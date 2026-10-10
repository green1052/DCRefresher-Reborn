// @vitest-environment node
import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import background from "@/features/write/background";
import {hookUploads, UPLOAD_OPTIONS_KEY} from "@/features/write/images";

type Sender = Browser.runtime.MessageSender;
type Handler = (message: { sender: Sender }) => Promise<void>;

const onMessage = vi.hoisted(() => vi.fn<(type: string, handler: Handler) => void>());
vi.mock("@/core/messaging/protocol", () => ({onMessage}));

/** 탭에서 온 메시지의 보낸 쪽. 탭은 runInPage가 읽는 id만 채운다. */
const fromTab = (id: number | undefined, fields: Omit<Sender, "tab"> = {}): Sender => ({tab: {id}, ...fields}) as Sender;

/** listen이 건 refresher:hookUploads 리스너를 sender가 보낸 것처럼 부른다. */
const receive = async (sender: Sender): Promise<void> => {
    background.listen?.();
    const handler = onMessage.mock.calls.find(([type]) => type === "refresher:hookUploads")?.[1];
    expect(handler).toBeDefined();
    await handler?.({sender});
};

const executeScript = () => vi.spyOn(fakeBrowser.scripting, "executeScript").mockResolvedValue(undefined);

describe("refresher:hookUploads", () => {
    it("보낸 문서(documentId)의 MAIN world에 hookUploads를 넣는다", async () => {
        const execute = executeScript();

        await receive(fromTab(3, {frameId: 2, documentId: "doc"}));

        expect(execute).toHaveBeenCalledWith({target: {tabId: 3, documentIds: ["doc"]}, world: "MAIN", func: hookUploads, args: [UPLOAD_OPTIONS_KEY]});
    });

    it("documentId가 없으면(파이어폭스) 프레임 번호로, 그것도 없으면 최상위 프레임에 넣는다", async () => {
        const execute = executeScript();

        await receive(fromTab(3, {frameId: 2}));
        await receive(fromTab(4));

        expect(execute).toHaveBeenNthCalledWith(1, expect.objectContaining({target: {tabId: 3, frameIds: [2]}}));
        expect(execute).toHaveBeenNthCalledWith(2, expect.objectContaining({target: {tabId: 4, frameIds: [0]}}));
    });

    it("탭이 없는 확장 페이지가 보내면 넣지 않는다", async () => {
        const execute = executeScript();

        await receive({});
        await receive(fromTab(undefined));

        expect(execute).not.toHaveBeenCalled();
    });

    it("넣지 못하면 오류를 남기고 던지지 않는다", async () => {
        const error = new Error("Cannot access contents of the page");
        vi.spyOn(fakeBrowser.scripting, "executeScript").mockRejectedValue(error);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(receive(fromTab(3, {documentId: "doc"}))).resolves.toBeUndefined();

        expect(log).toHaveBeenCalledWith(error);
    });
});
