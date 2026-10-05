import {beforeEach, describe, expect, it, vi} from "vitest";
import type {Browser} from "wxt/browser";
import {fakeBrowser} from "wxt/testing/fake-browser";

import background from "@/features/imagesearch/background";

// fake-browser에는 contextMenus가 없어 목으로 둔다.
beforeEach(() => {
    vi.spyOn(fakeBrowser.contextMenus, "create").mockReturnValue(0);
    vi.spyOn(fakeBrowser.contextMenus, "remove").mockResolvedValue(undefined);
});

const SRC = "https://dcimg8.dcinside.co.kr/viewimage.php?id=abc&no=1";

describe("apply", () => {
    it("켠 엔진마다 이미지 메뉴를 만든다", async () => {
        await background.apply({enabled: true, settings: {saucenao: true, yandex: true, iqdb: false}});
        const created = vi.mocked(fakeBrowser.contextMenus.create).mock.calls.map(([properties]) => properties);
        expect(created.map((properties) => properties.id)).toEqual(["imagesearch:saucenao", "imagesearch:yandex"]);
        expect(created[0]).toMatchObject({title: "SauceNao 검색", contexts: ["image"]});
    });

    it("먼저 이 모듈의 메뉴만 지우고, 끄면 만들지 않는다", async () => {
        vi.mocked(fakeBrowser.contextMenus.remove).mockRejectedValue(new Error("없는 메뉴"));
        await background.apply({enabled: false, settings: {saucenao: true}});
        const removed = vi.mocked(fakeBrowser.contextMenus.remove).mock.calls.map(([id]) => String(id));
        expect(removed).toContain("imagesearch:saucenao");
        expect(removed.every((id) => id.startsWith("imagesearch:"))).toBe(true);
        expect(fakeBrowser.contextMenus.create).not.toHaveBeenCalled();
    });
});

describe("listen", () => {
    type ClickListener = Parameters<typeof fakeBrowser.contextMenus.onClicked.addListener>[0];

    /** 메뉴 클릭 리스너를 걸고 돌려준다. 탭 열기는 목으로 받는다. */
    const listen = () => {
        const create = vi.spyOn(fakeBrowser.tabs, "create").mockResolvedValue(undefined);
        let clicked: ClickListener | undefined;
        vi.spyOn(fakeBrowser.contextMenus.onClicked, "addListener").mockImplementation((listener) => {
            clicked = listener;
        });
        background.listen?.();
        return {create, clicked: clicked!};
    };

    const info = (menuItemId: string, srcUrl?: string): Browser.contextMenus.OnClickData => ({menuItemId, srcUrl, editable: false, pageUrl: "https://gall.dcinside.com/"});

    const tab = (fields: Partial<Browser.tabs.Tab>): Browser.tabs.Tab => ({
        index: 0, pinned: false, highlighted: false, windowId: 1, active: true, frozen: false, incognito: false,
        selected: false, discarded: false, autoDiscardable: true, groupId: -1, lastAccessed: 0, ...fields
    });

    it("이미지가 있던 탭 옆에 검색 탭을 연다", async () => {
        const {create, clicked} = listen();
        await clicked(info("imagesearch:tineye", SRC), tab({id: 7, index: 2, windowId: 3}));
        expect(create).toHaveBeenCalledWith({url: `https://tineye.com/search?url=${encodeURIComponent("https://image.dcinside.com/dccon.php?id=abc&no=1")}`, index: 3, openerTabId: 7, windowId: 3});
    });

    it("다른 메뉴나 주소 없는 클릭은 넘긴다", async () => {
        const {create, clicked} = listen();
        await clicked(info("other:saucenao", SRC));
        await clicked(info("imagesearch:saucenao"));
        expect(create).not.toHaveBeenCalled();
    });

    it("탭 정보가 없으면 주소만으로 연다", async () => {
        const {create, clicked} = listen();
        await clicked(info("imagesearch:saucenao", SRC), tab({id: -1}));
        expect(create).toHaveBeenCalledWith({url: expect.stringContaining("saucenao.com")});
    });
});
