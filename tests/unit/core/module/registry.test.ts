import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {getModuleApi, loadAll, moduleSettingsStore, pageToggleStates, runPageToggle, runShortcut} from "@/core/module/registry";

import {setting, testModule, tick} from "../../../helpers";

const settingsOf = (id: string, value: unknown) => fakeBrowser.storage.local.set({[`refresher:module:${id}:settings`]: value});
const enables = (value: Record<string, boolean>) => fakeBrowser.storage.local.set({"refresher:modules": value});

// 레지스트리는 모듈 단위 싱글턴이라 테스트마다 다른 id를 쓴다.
describe("loadAll", () => {
    it("한 번의 읽기로 on/off와 설정을 맞추고, 저장소 변경을 따라 켜고 끄고 설정 리스너를 부른다", async () => {
        await enables({a: true, b: true});
        await settingsOf("a", {size: 9999, zzz: 1});

        const setup = vi.fn();
        const revoke = vi.fn();
        const onChanged = vi.fn();
        const a = testModule({
            id: "a",
            settings: {size: setting({type: "range", default: 5, min: 1, max: 10, step: 1, unit: ""}), flag: setting({type: "check", default: true})},
            setup: (ctx) => {
                setup({...ctx.settings});
                ctx.onSettingsChanged((key) => onChanged(key));
                return {ctx};
            },
            revoke
        });
        const b = testModule({id: "b", setup: () => "b-api"});
        // urls가 이 문서와 맞지 않는 모듈은 등록조차 되지 않는다.
        const c = testModule({id: "c", urls: [/never/], setup: vi.fn()});

        const getSpy = vi.spyOn(fakeBrowser.storage.local, "get");
        await loadAll([a, b, c], new AbortController().signal);
        // on/off + 모듈 설정 전부를 storage.local.get 한 번으로 읽는다 (마지막 sync 확인 읽기 하나가 더 있다).
        expect(getSpy).toHaveBeenCalledTimes(2);
        expect(getSpy.mock.calls[0]?.[0]).toEqual(["refresher:modules", "refresher:module:a:settings", "refresher:module:b:settings"]);

        // 저장값은 스키마에 맞춰지고(9999 → 10), 없는 키는 기본값이다.
        expect(setup).toHaveBeenCalledWith({size: 10, flag: true});
        expect(getModuleApi("b" as never)).toBe("b-api");
        expect(c.setup).not.toHaveBeenCalled();

        // 설정이 바뀌면 바뀐 키만 리스너에 알린다
        await settingsOf("a", {size: 3, flag: true});
        await tick();
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(onChanged).toHaveBeenCalledWith("size");
        expect((getModuleApi("a" as never) as unknown as { ctx: { settings: { size: number } } }).ctx.settings.size).toBe(3);

        // 끄면 revoke, 다시 켜면 setup
        await enables({a: false, b: true});
        await tick();
        expect(revoke).toHaveBeenCalledTimes(1);
        expect(getModuleApi("a" as never)).toBeUndefined();
        await enables({a: true, b: true});
        await tick();
        expect(setup).toHaveBeenCalledTimes(2);
        expect(setup).toHaveBeenLastCalledWith({size: 3, flag: true});
    });

    it("저장소를 읽는 사이 바뀐 설정도 놓치지 않는다", async () => {
        await enables({late: true});
        await settingsOf("late", {size: 3});
        const setup = vi.fn();
        const late = testModule({
            id: "late",
            settings: {size: setting({type: "range", default: 5, min: 1, max: 10, step: 1, unit: ""})},
            setup: (ctx) => void setup(ctx.settings.size)
        });

        // 옛 값을 읽어 돌려주기 직전에 옵션 페이지가 설정을 바꾼다.
        const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
        vi.spyOn(fakeBrowser.storage.local, "get").mockImplementationOnce(async (keys) => {
            const read = await get(keys);
            await settingsOf("late", {size: 7});
            await tick();
            return read;
        });
        await loadAll([late], new AbortController().signal);
        expect(setup).toHaveBeenCalledWith(7);
        expect(moduleSettingsStore.getState().late).toEqual({size: 7});
    });

    it("setup이 끝난 모듈에만 단축키·팝업 토글이 간다", async () => {
        await enables({d: true, e: true});
        let release!: () => void;
        const toggled = vi.fn();
        const shortcut = vi.fn();
        const d = testModule<{ on: boolean }>({
            id: "d",
            setup: () => ({on: false}),
            shortcuts: {refreshLists: (_ctx, api) => shortcut(api)},
            pageToggles: [{id: "t", label: "토글", icon: null as never, desc: (api) => `on=${api.on}`, isOn: (api) => api.on, toggle: (api) => toggled((api.on = !api.on))}]
        });
        const e = testModule({
            id: "e",
            setup: () => new Promise<void>((resolve) => (release = resolve)),
            shortcuts: {refreshLists: shortcut}
        });

        const loaded = loadAll([d, e], new AbortController().signal);
        await tick();
        runShortcut("refreshLists");
        expect(shortcut).toHaveBeenCalledTimes(1);
        expect(shortcut).toHaveBeenCalledWith({on: false});

        expect(pageToggleStates()).toEqual([{module: "d", id: "t", label: "토글", desc: "on=false", on: false}]);
        runPageToggle({module: "d", id: "t"});
        expect(toggled).toHaveBeenCalledWith(true);
        expect(pageToggleStates()[0]?.on).toBe(true);

        release();
        await loaded;
        runShortcut("refreshLists");
        expect(shortcut).toHaveBeenCalledTimes(3);
    });

    it("setup이 던진 모듈은 반쪽 상태로 남지 않는다", async () => {
        await enables({f: true});
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const f = testModule({id: "f", setup: () => {
            throw new Error("boom");
        }});
        await loadAll([f], new AbortController().signal);
        expect(getModuleApi("f" as never)).toBeUndefined();
        expect(error).toHaveBeenCalledWith("Failed to load module: f", expect.any(Error));
    });
});

describe("moduleSettingsStore", () => {
    it("이 페이지에 등록하지 않는 모듈도 UI가 읽을 기본 설정이 있고, 등록한 모듈은 저장된 값이다", async () => {
        await settingsOf("s1", {size: 3});
        const size = setting({type: "range", default: 5, min: 1, max: 10, step: 1, unit: ""});
        const here = testModule({id: "s1", settings: {size}, setup: () => undefined});
        const elsewhere = testModule({id: "s2", urls: [/never/], settings: {size}, setup: () => undefined});

        await loadAll([here, elsewhere], new AbortController().signal);
        expect(moduleSettingsStore.getState().s1).toEqual({size: 3});
        expect(moduleSettingsStore.getState().s2).toEqual({size: 5});
    });
});
