import {render} from "preact";
import {act} from "preact/test-utils";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {stored, tick} from "../../helpers";

type ModulesStore = typeof import("@/stores/modules");

// initModulesStore는 한 번만 돌므로 테스트마다 스토어를 새로 불러온다.
let modules: ModulesStore;
beforeEach(async () => {
    vi.resetModules();
    modules = await import("@/stores/modules");
});

const state = () => modules.useModulesStore.getState();

describe("useModulesStore", () => {
    it("처음에는 defaultEnable과 설정 기본값이다", () => {
        expect(state().enables.fonts).toBe(true);
        expect(state().enables.stealth).toBe(false);
        expect(state().values.fonts?.bodyFontSize).toBe(13);
    });

    it("toggle은 바로 반영하고 다른 모듈의 값을 지키며 저장한다", async () => {
        await fakeBrowser.storage.local.set({"refresher:modules": {stealth: true}});

        const toggling = state().toggle("fonts", false);
        expect(state().enables.fonts).toBe(false);
        await toggling;

        expect(await stored("refresher:modules")).toEqual({stealth: true, fonts: false});
    });

    it("changeSetting은 스키마로 맞춰 저장하고 다른 키를 지킨다", async () => {
        await fakeBrowser.storage.local.set({"refresher:module:fonts:settings": {changeDCFont: false}});

        await state().changeSetting("fonts", "bodyFontSize", 99);

        expect(state().values.fonts?.bodyFontSize).toBe(30);
        expect(await stored("refresher:module:fonts:settings")).toEqual({changeDCFont: false, bodyFontSize: 30});
    });

    it("스키마에 없는 설정은 무시한다", async () => {
        const set = vi.spyOn(fakeBrowser.storage.local, "set");

        await state().changeSetting("fonts", "missing", 1);
        await state().changeSetting("missing", "bodyFontSize", 1);

        expect(set).not.toHaveBeenCalled();
        expect(state().values.missing).toBeUndefined();
    });

    it("동시에 바꾼 설정이 서로 덮지 않는다", async () => {
        await Promise.all([state().changeSetting("fonts", "bodyFontSize", 20), state().changeSetting("fonts", "changeDCFont", false)]);

        expect(await stored("refresher:module:fonts:settings")).toEqual({bodyFontSize: 20, changeDCFont: false});
    });

    it("저장이 실패하면 저장소 값으로 되돌리고 던진다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await fakeBrowser.storage.local.set({"refresher:modules": {fonts: true}});
        vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("quota"));

        await expect(state().toggle("fonts", false)).rejects.toThrow("quota");

        expect(state().enables.fonts).toBe(true);
    });
});

describe("initModulesStore", () => {
    it("저장된 값을 읽고 변경을 따른다", async () => {
        await fakeBrowser.storage.local.set({"refresher:modules": {stealth: true, fonts: "x"}, "refresher:module:fonts:settings": {bodyFontSize: 20}});

        await modules.initModulesStore();
        expect(state().enables).toMatchObject({stealth: true, fonts: true});
        expect(state().values.fonts?.bodyFontSize).toBe(20);

        await fakeBrowser.storage.local.set({"refresher:module:fonts:settings": {bodyFontSize: 21}});
        expect(state().values.fonts?.bodyFontSize).toBe(21);
    });

    it("이 창이 쓴 값이 돌아오면 상태를 다시 바꾸지 않는다", async () => {
        await modules.initModulesStore();
        const listener = vi.fn();
        modules.useModulesStore.subscribe(listener);

        await state().changeSetting("fonts", "bodyFontSize", 20);
        await state().toggle("stealth", true);

        // 화면에 먼저 반영한 두 번뿐이다.
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("없어진 모듈의 값·캐시와 스키마에 없는 설정을 지운다", async () => {
        await fakeBrowser.storage.local.set({
            "refresher:modules": {gone: true, fonts: false},
            "refresher:module:gone:settings": {a: 1},
            "refresher:module:gone:data": {b: 1},
            "refresher:module:old:data": {c: 1},
            "refresher:module:fonts:settings": {bodyFontSize: 99, removed: true},
            "refresher:module:preview:data": {kept: true},
            "refresher:block:NICK": []
        });

        await modules.initModulesStore();

        await expect.poll(() => fakeBrowser.storage.local.get(null)).toEqual({
            "refresher:modules": {fonts: false},
            // 남은 값은 검사 전 그대로 둔다.
            "refresher:module:fonts:settings": {bodyFontSize: 99},
            "refresher:module:preview:data": {kept: true},
            "refresher:block:NICK": []
        });
    });

    it("지울 것이 없으면 쓰지 않는다", async () => {
        await fakeBrowser.storage.local.set({"refresher:modules": {fonts: false}, "refresher:module:fonts:settings": {bodyFontSize: 20}});
        const set = vi.spyOn(fakeBrowser.storage.local, "set");
        const remove = vi.spyOn(fakeBrowser.storage.local, "remove");

        await modules.initModulesStore();
        await tick();
        await tick();

        expect(set).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
    });
});

describe("useExtensionPageVars", () => {
    const mount = () => {
        const Vars = () => {
            modules.useExtensionPageVars();
            return null;
        };
        const root = document.createElement("div");
        act(() => render(<Vars/>, root));
        return () => act(() => render(null, root));
    };
    const fontVar = () => document.documentElement.style.getPropertyValue("--refresher-font");

    it("켜진 모듈의 변수를 넣고 끄거나 내리면 뺀다", async () => {
        const unmount = mount();
        expect(fontVar()).toBe(`"Noto Sans CJK KR", "NanumGothic", sans-serif`);

        await act(() => state().changeSetting("fonts", "customFonts", "A"));
        expect(fontVar()).toBe(`"A", sans-serif`);

        await act(() => state().toggle("fonts", false));
        expect(fontVar()).toBe("");

        await act(() => state().toggle("fonts", true));
        unmount();
        expect(fontVar()).toBe("");
    });
});
