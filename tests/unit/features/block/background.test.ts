// @vitest-environment node
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {sendMessage} from "@/core/messaging/protocol";
import {settingsOf} from "@/core/module/settings";
import {IMAGE_HOST_ORIGINS} from "@/core/pages";
import background from "@/features/block/background";

vi.mock("@/core/messaging/protocol", () => ({sendMessage: vi.fn(async () => undefined)}));

const IMAGE = "https://dcimg8.dcinside.co.kr/viewimage.php?id=x&no=1";
const apply = (enabled: boolean, similarImages = false) => background.apply?.({enabled, settings: settingsOf(background, {similarImages})});
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
});
afterEach(() => vi.unstubAllEnvs());

describe("block 배경 (크롬)", () => {
    it("켜면 글 목록·본문의 이미지·움짤에만 메뉴를 걸고 CORS 규칙을 넣으며, 끄면 둘 다 뺀다", async () => {
        const menus = fakeMenus();
        const updateSessionRules = vi.spyOn(fakeBrowser.declarativeNetRequest, "updateSessionRules").mockResolvedValue();

        await apply(true);
        expect(menus.get("block:image")).toMatchObject({contexts: ["image", "video"], documentUrlPatterns: expect.arrayContaining(["https://gall.dcinside.com/*board/view/*"])});
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

    it("탭에 받는 쪽이 없으면 그 프레임에 새로고침 안내를 띄운다", async () => {
        let onClicked: Parameters<typeof fakeBrowser.contextMenus.onClicked.addListener>[0] | undefined;
        vi.spyOn(fakeBrowser.contextMenus.onClicked, "addListener").mockImplementation((listener) => void (onClicked = listener));
        fakeBrowser.permissions.request = vi.fn(async () => true);
        const executeScript = vi.spyOn(fakeBrowser.scripting, "executeScript").mockResolvedValue(undefined);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.mocked(sendMessage).mockRejectedValueOnce(new Error("No response"));
        background.listen?.();

        onClicked?.({menuItemId: "block:image", srcUrl: IMAGE, frameId: 3, editable: false, pageUrl: ""}, {id: 7} as Browser.tabs.Tab);
        await vi.waitFor(() => expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({target: {tabId: 7, frameIds: [3]}})));
    });
});
