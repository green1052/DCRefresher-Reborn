import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import background from "@/entrypoints/background/index";

const onMessage = vi.hoisted(() => vi.fn<(type: string) => void>());
vi.mock("@/core/messaging/protocol", () => ({onMessage, sendMessage: vi.fn()}));

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
});
