// @vitest-environment node
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";
import {storage} from "wxt/utils/storage";

import {onMessage, sendMessage} from "@/core/messaging/protocol";
import {settingsOf} from "@/core/module/settings";
import {IMAGE_HOST_ORIGINS} from "@/core/pages";
import background from "@/features/block/background";
import {sha256} from "@/utils/hash";
import {imageFingerprints} from "@/utils/imageFingerprint";

vi.mock("@/core/messaging/protocol", () => ({onMessage: vi.fn(), sendMessage: vi.fn(async () => undefined)}));
vi.mock("@/utils/imageFingerprint", () => ({imageFingerprints: vi.fn()}));

const IMAGE = "https://dcimg8.dcinside.co.kr/viewimage.php?id=x&no=1";
const apply = (enabled: boolean, similarImages = false) => background.apply?.({enabled, settings: settingsOf(background, {similarImages})});
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
});

describe("block 배경 (파이어폭스)", () => {
    /**
     * webRequest.onBeforeRequest·onErrorOccurred와 filterResponseData를 흉내 낸다. respond(url, chunks)는 페이지가 받는 응답 하나를 흘려보낸다.
     * 그 요청에 필터를 걸었을 때만 본문이 지나가고, failed면 받은 만큼으로 stop이 온 뒤 오류가 온다.
     */
    const fakeWebRequest = () => {
        const listeners = new Set<(details: Browser.webRequest.OnBeforeRequestDetails) => unknown>();
        const event = fakeBrowser.webRequest.onBeforeRequest;
        vi.spyOn(event, "addListener").mockImplementation((listener) => void listeners.add(listener));
        vi.spyOn(event, "removeListener").mockImplementation((listener) => void listeners.delete(listener));
        vi.spyOn(event, "hasListener").mockImplementation((listener) => listeners.has(listener));
        const errorListeners = new Set<(details: Browser.webRequest.OnErrorOccurredDetails) => void>();
        vi.spyOn(fakeBrowser.webRequest.onErrorOccurred, "addListener").mockImplementation((listener) => void errorListeners.add(listener));
        vi.spyOn(fakeBrowser.webRequest.onErrorOccurred, "removeListener").mockImplementation((listener) => void errorListeners.delete(listener));

        let filter: { ondata?: (ev: { data: ArrayBuffer }) => void; onstop?: () => void; write: () => void; close: () => void };
        const filterResponseData = vi.fn(() => (filter = {write: vi.fn(), close: vi.fn()}));
        Object.assign(fakeBrowser.webRequest, {filterResponseData});

        let requests = 0;
        const respond = (url: string, chunks: (string | Uint8Array)[], type = "image", failed = false): void => {
            const requestId = String(++requests);
            const filters = filterResponseData.mock.calls.length;
            for (const listener of listeners) listener({requestId, url, type} as Browser.webRequest.OnBeforeRequestDetails);
            if (filterResponseData.mock.calls.length > filters) {
                for (const chunk of chunks) filter.ondata?.({data: (typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk.slice()).buffer});
                filter.onstop?.();
            }
            if (failed) for (const listener of errorListeners) listener({requestId, url, type, error: "NS_BINDING_ABORTED"} as Browser.webRequest.OnErrorOccurredDetails);
        };
        return {listeners, errorListeners, respond, filterResponseData};
    };

    /** 탭이 묻는 refresher:imageHash의 처리기. */
    const askHash = (url: string, similar = true) => {
        const handler = vi.mocked(onMessage).mock.calls.find(([type]) => type === "refresher:imageHash")?.[1];
        return handler?.({data: {url, similar}} as never);
    };

    beforeEach(() => {
        vi.stubEnv("BROWSER", "firefox");
        fakeMenus();
    });

    it("차단한 이미지가 있을 때만 응답을 엿보고, 목록이 바뀌면 다시 맞춘다", async () => {
        const {listeners, errorListeners} = fakeWebRequest();
        background.listen?.();

        await apply(true);
        expect(listeners.size).toBe(0);

        await setImageList([{id: "a", content: "x", isRegex: false}]);
        await vi.waitFor(() => expect(listeners.size).toBe(1));
        expect(errorListeners.size).toBe(1);

        await apply(false);
        expect(listeners.size).toBe(0);
        expect(errorListeners.size).toBe(0);
    });

    it("페이지가 받은 이미지의 해시를 구해 두고, 다 구한 주소는 다시 받아도 엿보지 않는다", async () => {
        await setImageList([{id: "a", content: "x", isRegex: false}, null]);
        const {respond, filterResponseData} = fakeWebRequest();
        background.listen?.();
        await apply(true);

        const url = `${IMAGE}&t=again`;
        respond(url, ["ab", "c"]);
        const file = await sha256(new TextEncoder().encode("abc"));
        expect(await askHash(url)).toEqual({file, similar: undefined});

        respond(url, ["abc"]);
        expect(filterResponseData).toHaveBeenCalledOnce();
    });

    it("중간에 끊긴 요청이 남긴 해시는 지우고, 다음 요청을 다시 엿봐 온전한 파일로 구한다", async () => {
        await setImageList([{id: "a", content: "x", isRegex: false}]);
        const {respond, filterResponseData} = fakeWebRequest();
        background.listen?.();
        await apply(true);

        const url = `${IMAGE}&t=aborted`;
        respond(url, ["ab"], "image", true);
        await flush();
        expect(await askHash(url)).toBeUndefined();

        respond(url, ["ab", "c"]);
        expect(filterResponseData).toHaveBeenCalledTimes(2);
        expect(await askHash(url)).toEqual({file: await sha256(new TextEncoder().encode("abc")), similar: undefined});
    });

    it("지문이 새로 필요해진 주소의 본문 없는 재검증 응답은 앞서 구한 해시를 남긴다", async () => {
        await setImageList([{id: "a", content: "x", isRegex: false}]);
        const {respond} = fakeWebRequest();
        background.listen?.();
        await apply(true);

        const url = `${IMAGE}&t=304`;
        respond(url, ["abc"]);
        const file = await sha256(new TextEncoder().encode("abc"));
        expect(await askHash(url)).toEqual({file, similar: undefined});

        // 비슷한 이미지 설정을 켜 다시 엿보지만, 304라 본문이 지나가지 않는다.
        await setImageList([{id: "a", content: "x", isRegex: false, similar: "0".repeat(32)}]);
        await apply(true, true);
        respond(url, []);
        expect(await askHash(url)).toEqual({file, similar: undefined});
    });

    it("움짤(media)은 mp4 파일 전체가 지나갔을 때만 해시하고, 구간 요청으로 일부만 오면 해시하지 않는다", async () => {
        await setImageList([{id: "a", content: "x", isRegex: false}]);
        const {respond} = fakeWebRequest();
        background.listen?.();
        await apply(true);

        // ftyp(16바이트) + mdat(12바이트)
        const mp4 = Uint8Array.from([0, 0, 0, 16, 102, 116, 121, 112, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 109, 100, 97, 116, 1, 2, 3, 4]);
        const url = `${IMAGE}&t=mp4`;
        respond(url, [mp4.subarray(16)], "media");
        expect(await askHash(url)).toBeUndefined();

        respond(url, [mp4.subarray(0, 20), mp4.subarray(20)], "media");
        expect(await askHash(url)).toEqual({file: await sha256(mp4), similar: undefined});
    });

    it("파일 해시만 물으면 지문을 기다리지 않고 답한다", async () => {
        await setImageList([{id: "a", content: "x", isRegex: false, similar: "0".repeat(32)}]);
        const {respond} = fakeWebRequest();
        background.listen?.();
        await apply(true, true);
        // 다른 탭의 지문 계산이 밀려 있어 끝나지 않는다.
        vi.mocked(imageFingerprints).mockReturnValue(new Promise(() => {}));

        respond(`${IMAGE}&t=file`, ["abc"]);
        expect(await askHash(`${IMAGE}&t=file`, false)).toEqual({file: await sha256(new TextEncoder().encode("abc"))});
    });
});
