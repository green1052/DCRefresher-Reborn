// @vitest-environment node
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";
import {storage} from "wxt/utils/storage";

import {onMessage, sendMessage} from "@/core/messaging/protocol";
import {settingsOf} from "@/core/module/settings";
import {IMAGE_HOST_ORIGINS} from "@/core/pages";
import background from "@/features/block/background";
import {sha256} from "@/utils/hash";

vi.mock("@/core/messaging/protocol", () => ({onMessage: vi.fn(), sendMessage: vi.fn(async () => undefined)}));

const IMAGE = "https://dcimg8.dcinside.co.kr/viewimage.php?id=x&no=1";
const apply = (enabled: boolean) => background.apply?.({enabled, settings: settingsOf(background, {})});
const setImageList = (list: unknown[]) => storage.setItem("local:refresher:block:IMAGE", list);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** fake-browser에 없는 contextMenus를 흉내 낸다. 클릭 리스너는 걸기만 한다 (크롬 테스트가 따로 꺼낸다). */
const fakeMenus = () => {
    const menus = new Map<string | number, Browser.contextMenus.CreateProperties>();
    vi.spyOn(fakeBrowser.contextMenus.onClicked, "addListener").mockImplementation(() => undefined);
    vi.spyOn(fakeBrowser.contextMenus, "create").mockImplementation((properties) => {
        menus.set(properties.id!, properties);
        return properties.id!;
    });
    vi.spyOn(fakeBrowser.contextMenus, "remove").mockImplementation(async (id) => {
        if (!menus.delete(id)) throw new Error(`no menu ${id}`);
    });
    return menus;
};

beforeEach(() => {
    fakeBrowser.reset();
    vi.mocked(sendMessage).mockClear();
    vi.mocked(onMessage).mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("block 배경 (크롬)", () => {
    it("켜면 글 목록·본문에만 이미지 메뉴를 걸고 CORS 규칙을 넣으며, 끄면 둘 다 뺀다", async () => {
        const menus = fakeMenus();
        const updateSessionRules = vi.spyOn(fakeBrowser.declarativeNetRequest, "updateSessionRules").mockResolvedValue();

        await apply(true);
        expect(menus.get("block:image")).toMatchObject({contexts: ["image"], documentUrlPatterns: expect.arrayContaining(["https://gall.dcinside.com/*board/view/*"])});
        expect(updateSessionRules).toHaveBeenLastCalledWith({removeRuleIds: [1], addRules: [expect.objectContaining({id: 1})]});

        await apply(false);
        expect(menus.size).toBe(0);
        expect(updateSessionRules).toHaveBeenLastCalledWith({removeRuleIds: [1], addRules: []});
    });

    it("메뉴를 누르면 이미지 호스트 권한을 묻고, 받았을 때만 그 탭에 차단을 보낸다", async () => {
        let onClicked: Parameters<typeof fakeBrowser.contextMenus.onClicked.addListener>[0] | undefined;
        vi.spyOn(fakeBrowser.contextMenus.onClicked, "addListener").mockImplementation((listener) => void (onClicked = listener));
        const answers = [false, true];
        const request = vi.fn(async () => answers.shift() ?? false);
        // fake-browser는 permissions.request를 던진다. 콜백 오버로드 때문에 spyOn의 반환 타입이 void라 함수를 바꿔 넣는다.
        fakeBrowser.permissions.request = request;
        background.listen?.();

        const click = {menuItemId: "block:image", srcUrl: IMAGE, frameId: 3, editable: false, pageUrl: ""};
        const tab = {id: 7} as Browser.tabs.Tab;
        onClicked?.(click, tab);
        await flush();
        expect(request).toHaveBeenLastCalledWith({origins: IMAGE_HOST_ORIGINS});
        expect(sendMessage).not.toHaveBeenCalled();

        onClicked?.(click, tab);
        await flush();
        expect(sendMessage).toHaveBeenCalledWith("refresher:blockImage", IMAGE, {tabId: 7, frameId: 3});
    });
});

describe("block 배경 (파이어폭스)", () => {
    /** webRequest.onBeforeRequest와 filterResponseData를 흉내 낸다. respond(url, chunks)는 페이지가 받는 응답 하나를 흘려보낸다. */
    const fakeWebRequest = () => {
        const listeners = new Set<(details: Browser.webRequest.OnBeforeRequestDetails) => unknown>();
        const event = fakeBrowser.webRequest.onBeforeRequest;
        vi.spyOn(event, "addListener").mockImplementation((listener) => void listeners.add(listener));
        vi.spyOn(event, "removeListener").mockImplementation((listener) => void listeners.delete(listener));
        vi.spyOn(event, "hasListener").mockImplementation((listener) => listeners.has(listener));

        let filter: { ondata?: (ev: { data: ArrayBuffer }) => void; onstop?: () => void; write: () => void; close: () => void };
        Object.assign(fakeBrowser.webRequest, {filterResponseData: () => (filter = {write: vi.fn(), close: vi.fn()})});

        const respond = (url: string, chunks: string[]): void => {
            for (const listener of listeners) listener({requestId: "1", url} as Browser.webRequest.OnBeforeRequestDetails);
            for (const chunk of chunks) filter.ondata?.({data: new TextEncoder().encode(chunk).buffer});
            filter.onstop?.();
        };
        return {listeners, respond};
    };

    /** 탭이 묻는 refresher:imageHash의 처리기. */
    const askHash = (url: string) => {
        const handler = vi.mocked(onMessage).mock.calls.find(([type]) => type === "refresher:imageHash")?.[1];
        return handler?.({data: url} as never);
    };

    beforeEach(() => {
        vi.stubEnv("BROWSER", "firefox");
        fakeMenus();
    });

    it("차단한 이미지가 있을 때만 응답을 엿보고, 목록이 바뀌면 다시 맞춘다", async () => {
        const {listeners} = fakeWebRequest();
        background.listen?.();

        await apply(true);
        expect(listeners.size).toBe(0);

        await setImageList([{id: "a", content: "x", isRegex: false}]);
        await vi.waitFor(() => expect(listeners.size).toBe(1));

        await apply(false);
        expect(listeners.size).toBe(0);
    });

    it("페이지가 받은 이미지의 해시를 구해 두고, 본문 없는 재검증 응답은 앞서 구한 해시를 남긴다", async () => {
        await setImageList([{id: "a", content: "x", isRegex: false}, null]);
        const {respond} = fakeWebRequest();
        background.listen?.();
        await apply(true);

        respond(IMAGE, ["ab", "c"]);
        const file = await sha256(new TextEncoder().encode("abc"));
        expect(await askHash(IMAGE)).toEqual({file, similar: undefined});

        // 304: 본문이 지나가지 않는다.
        respond(IMAGE, []);
        expect(await askHash(IMAGE)).toEqual({file, similar: undefined});
    });
});
