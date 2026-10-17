import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import background from "@/entrypoints/background/index";

const onMessage = vi.hoisted(() => vi.fn<(type: string) => void>());
const sendMessage = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/core/messaging/protocol", () => ({onMessage, sendMessage}));

describe("배경 메시지 처리기", () => {
    it("배경과 모듈의 배경 쪽(features/<id>/background.ts)이 같은 메시지 이름을 두 번 걸지 않는다", () => {
        // @webext-core/messaging은 같은 이름을 두 번 걸면 던지고, 배경 모듈의 listen은 그 오류를 남기기만 하므로 여기서 잡는다.
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        // 가짜 브라우저에 단축키·메뉴 클릭 이벤트가 없다.
        vi.spyOn(fakeBrowser.commands.onCommand, "addListener").mockImplementation(() => {});
        vi.spyOn(fakeBrowser.contextMenus.onClicked, "addListener").mockImplementation(() => {});
        background.main();

        const types = onMessage.mock.calls.map(([type]) => type);
        expect(types).toContain("refresher:markUsed");
        expect(types).toContain("refresher:searchPosts");
        expect(types.filter((type, index) => types.indexOf(type) !== index)).toEqual([]);
        // listen이 실패한 모듈이 있으면 그 모듈의 이름은 모이지 않는다.
        expect(log).not.toHaveBeenCalled();
    });

    it("단축키는 콘텐츠 스크립트가 도는 탭에만 보낸다", async () => {
        // 받는 쪽이 없는 탭에 보내면 크롬이 "Unchecked runtime.lastError"를 남긴다.
        let listener: Parameters<typeof fakeBrowser.commands.onCommand.addListener>[0] | undefined;
        vi.spyOn(fakeBrowser.commands.onCommand, "addListener").mockImplementation((callback) => {
            listener = callback;
        });
        vi.spyOn(fakeBrowser.contextMenus.onClicked, "addListener").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        background.main();

        const press = (url?: string) => listener?.("refresh", {id: 1, url} as Browser.tabs.Tab);
        await press();
        await press("https://m.dcinside.com/board/programming");
        await press("https://example.com/");
        expect(sendMessage).not.toHaveBeenCalled();

        await press("https://gall.dcinside.com/board/lists?id=programming");
        expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:executeShortcut", "refresh", {tabId: 1});
    });
});
