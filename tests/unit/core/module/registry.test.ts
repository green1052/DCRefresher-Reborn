import {Puzzle} from "lucide-react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import type {ModuleContext} from "@/core/module/types";

import {setting, testModule, tick} from "../../../helpers";

type Registry = typeof import("@/core/module/registry");

// 레지스트리는 모듈 상태(등록된 모듈·stopAll 여부)를 들고 있으므로 테스트마다 새로 불러온다.
let registry: Registry;
// 앞 테스트의 레지스트리가 bfcache 리스너로 되살아나지 않게 테스트가 끝나면 컨텍스트를 끝낸다.
let context: AbortController;
beforeEach(async () => {
    vi.resetModules();
    registry = await import("@/core/module/registry");
    context = new AbortController();
});
afterEach(() => context.abort());

const setEnables = (value: Record<string, boolean>) => fakeBrowser.storage.local.set({"refresher:modules": value});
const setSettings = (id: string, value: unknown) => fakeBrowser.storage.local.set({[`refresher:module:${id}:settings`]: value});
const load = (defs: Parameters<Registry["loadAll"]>[0], signal = context.signal, ready?: Promise<void[]>) => registry.loadAll(defs, signal, ready);
/** 저장소 변경 알림을 막는다. 감시가 놓친 변경(bfcache·감시 전 쓰기)을 흉내 낸다. */
const muteWatchers = () => vi.spyOn(fakeBrowser.storage.local.onChanged, "trigger").mockResolvedValue([]);

const size = setting({type: "range", default: 5, min: 1, max: 10, step: 1, unit: ""});
const flag = setting({type: "check", default: true});
const name = setting({type: "text", default: "n"});

describe("loadAll", () => {
    it("저장된 설정을 스키마에 맞춰 setup에 넘긴다", async () => {
        await setSettings("a", {size: 9999, gone: 1});
        const setup = vi.fn((ctx: ModuleContext) => void ctx);

        await load([testModule({id: "a", settings: {size, flag}, setup})]);

        expect(setup.mock.calls[0]?.[0].settings).toEqual({size: 10, flag: true});
        expect(registry.moduleSettingsStore.getState()).toEqual({a: {size: 10, flag: true}});
    });

    it("on/off와 모든 설정을 한 번에 읽는다", async () => {
        const get = vi.spyOn(fakeBrowser.storage.local, "get");

        await load([testModule({id: "a", settings: {size}, setup: () => {}}), testModule({id: "b", settings: {flag}, setup: () => {}})]);

        expect(get.mock.calls[0]?.[0]).toEqual(["refresher:modules", "refresher:module:a:settings", "refresher:module:b:settings"]);
        // 나머지 한 번은 불러온 뒤의 on/off 확인이다.
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("urls가 이 페이지와 맞지 않으면 등록하지 않지만 기본 설정은 채운다", async () => {
        const get = vi.spyOn(fakeBrowser.storage.local, "get");
        const setup = vi.fn();

        await load([testModule({id: "far", urls: [/never-matches/], settings: {size}, setup})]);

        expect(setup).not.toHaveBeenCalled();
        expect(registry.moduleSettingsStore.getState()).toEqual({far: {size: 5}});
        expect(get.mock.calls[0]?.[0]).toEqual(["refresher:modules"]);
    });

    it("urls가 맞으면 돈다", async () => {
        const setup = vi.fn();
        await load([testModule({id: "near", urls: [/./], setup})]);
        expect(setup).toHaveBeenCalledTimes(1);
    });

    it("꺼진 모듈은 setup하지 않는다", async () => {
        await setEnables({off: false});
        const setup = vi.fn();

        await load([testModule({id: "off", setup}), testModule({id: "dormant", defaultEnable: false, setup})]);

        expect(setup).not.toHaveBeenCalled();
    });

    it("ready가 끝난 뒤에 setup한다", async () => {
        const ready = Promise.withResolvers<void[]>();
        const setup = vi.fn();

        const loading = load([testModule({id: "a", setup})], undefined, ready.promise);
        await tick();
        expect(setup).not.toHaveBeenCalled();

        ready.resolve([]);
        await loading;
        expect(setup).toHaveBeenCalledTimes(1);
    });

    it("ready가 실패하면 아무 모듈도 켜지 않는다", async () => {
        const setup = vi.fn();
        await expect(load([testModule({id: "a", setup})], undefined, Promise.reject(new Error("no blocks")))).rejects.toThrow("no blocks");
        expect(setup).not.toHaveBeenCalled();
    });

    it("읽는 사이 바뀐 설정을 놓치지 않는다", async () => {
        await setSettings("a", {size: 3});
        const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
        // 옛 값을 읽어 돌려주기 직전에 옵션 페이지가 설정을 바꾼다.
        vi.spyOn(fakeBrowser.storage.local, "get").mockImplementationOnce(async (keys) => {
            const read = await get(keys);
            await setSettings("a", {size: 7});
            return read;
        });
        const setup = vi.fn((ctx: ModuleContext) => void ctx);

        await load([testModule({id: "a", settings: {size}, setup})]);

        expect(setup.mock.calls[0]?.[0].settings.size).toBe(7);
    });

    it("불러오는 동안 켠 모듈도 끝나면 켠다", async () => {
        const slow = Promise.withResolvers<void>();
        const late = vi.fn();
        const loading = load([
            testModule({id: "slow", setup: () => slow.promise}),
            testModule({id: "late", defaultEnable: false, setup: late})
        ]);
        await tick();
        // on/off 감시를 걸기 전에 팝업이 켠다.
        await setEnables({late: true});
        slow.resolve();
        await loading;

        expect(late).toHaveBeenCalledTimes(1);
    });

    it("같은 id를 두 번 등록하면 뒤의 것만 실패한다", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const first = vi.fn();
        const second = vi.fn();

        await load([testModule({id: "dup", setup: first}), testModule({id: "dup", setup: second})]);

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith("Failed to load module: dup", expect.any(Error));
    });

    it("setup이 던지면 그 모듈만 멈추고 나머지는 돈다", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        let signal: AbortSignal | undefined;
        const revoke = vi.fn();
        const other = vi.fn();

        await load([
            testModule({
                id: "broken", revoke, setup: (ctx) => {
                    signal = ctx.signal;
                    throw new Error("boom");
                }
            }),
            testModule({id: "fine", setup: other})
        ]);

        expect(signal?.aborted).toBe(true);
        expect(revoke).toHaveBeenCalled();
        expect(other).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalled();
        expect(registry.runningModulesStore.getState()).toEqual({broken: false, fine: true});
    });

    it("setup이 실패한 모듈은 껐다 켤 때만 다시 setup한다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const setup = vi.fn(() => {
            throw new Error("boom");
        });

        await load([testModule({id: "broken", setup}), testModule({id: "fine", setup: () => {}})]);
        expect(setup).toHaveBeenCalledTimes(1);

        // 다른 모듈을 켜고 끄는 것으로는 다시 돌지 않는다.
        await setEnables({fine: false});
        await tick();
        await setEnables({fine: true});
        await tick();
        expect(setup).toHaveBeenCalledTimes(1);

        await setEnables({broken: false});
        await tick();
        await setEnables({broken: true});
        await tick();
        expect(setup).toHaveBeenCalledTimes(2);
    });
});

describe("설정 변경", () => {
    const setupWithListener = async (listener: (keys: ReadonlySet<string>) => void) => {
        let context: ModuleContext | undefined;
        await load([testModule({
            id: "a", settings: {size, flag, name}, setup: (ctx) => {
                context = ctx;
                ctx.onSettingsChanged(listener);
            }
        })]);
        return () => context!;
    };

    it("바뀐 키들로 리스너를 한 번 부르고 ctx.settings를 바꾼다", async () => {
        const listener = vi.fn();
        const ctx = await setupWithListener(listener);
        const before = registry.moduleSettingsStore.getState().a;

        await setSettings("a", {size: 3, flag: false, name: "n"});

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(new Set(["size", "flag"]));
        expect(ctx().settings).toEqual({size: 3, flag: false, name: "n"});
        // UI가 다시 그리도록 새 객체로 바꾼다.
        expect(registry.moduleSettingsStore.getState().a).toEqual({size: 3, flag: false, name: "n"});
        expect(registry.moduleSettingsStore.getState().a).not.toBe(before);
    });

    it("맞춘 값이 같으면 부르지 않는다", async () => {
        const listener = vi.fn();
        await setupWithListener(listener);

        // 범위 밖이라 기본값과 같은 쪽으로 맞춰지는 값만 바꾼다.
        await setSettings("a", {size: 5, ignored: 1});

        expect(listener).not.toHaveBeenCalled();
    });

    it("리스너 하나가 던져도 다음 리스너는 받는다", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const second = vi.fn();
        await load([testModule({
            id: "a", settings: {size}, setup: (ctx) => {
                ctx.onSettingsChanged(() => {
                    throw new Error("listener");
                });
                ctx.onSettingsChanged(second);
            }
        })]);

        await setSettings("a", {size: 2});

        expect(second).toHaveBeenCalledWith(new Set(["size"]));
        expect(error).toHaveBeenCalledWith("Settings listener failed: a", expect.any(Error));
    });

    it("꺼진 모듈의 설정도 반영해 다시 켤 때 새 값을 쓴다", async () => {
        await setEnables({a: false});
        const setup = vi.fn((ctx: ModuleContext) => ctx.settings.size);
        await load([testModule({id: "a", settings: {size}, setup})]);

        await setSettings("a", {size: 8});
        await setEnables({a: true});
        await tick();

        expect(setup).toHaveReturnedWith(8);
    });

    it("컨텍스트가 끝나면 더는 반영하지 않는다", async () => {
        const controller = new AbortController();
        const listener = vi.fn();
        const revoke = vi.fn();
        await load([testModule({id: "a", settings: {size}, revoke, setup: (ctx) => ctx.onSettingsChanged(listener)})], controller.signal);

        controller.abort();
        await setSettings("a", {size: 2});
        await setEnables({a: false});
        await tick();

        expect(listener).not.toHaveBeenCalled();
        expect(revoke).not.toHaveBeenCalled();
    });
});

describe("켜기·끄기", () => {
    it("끄면 정리하고 revoke하며, 다시 켜면 새로 setup한다", async () => {
        const cleanup = vi.fn();
        const revoke = vi.fn();
        const listener = vi.fn();
        const signals: AbortSignal[] = [];
        await load([testModule({
            id: "preview", settings: {size}, revoke, setup: (ctx) => {
                signals.push(ctx.signal);
                ctx.addCleanup(cleanup);
                ctx.onSettingsChanged(listener);
                return "api";
            }
        })]);
        expect(registry.getModuleApi("preview")).toBe("api");
        expect(registry.runningModuleSettings("preview")).toEqual({size: 5});

        await setEnables({preview: false});
        expect(signals[0]?.aborted).toBe(true);
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledTimes(1);
        expect(registry.getModuleApi("preview")).toBeUndefined();

        // 멈춘 실행의 설정 리스너는 부르지 않는다. 설정은 반영하지만 돌 때만 따르는 UI에는 주지 않는다.
        await setSettings("preview", {size: 2});
        expect(listener).not.toHaveBeenCalled();
        expect(registry.moduleSettings("preview")).toEqual({size: 2});
        expect(registry.runningModuleSettings("preview")).toBeUndefined();

        await setEnables({preview: true});
        await tick();
        expect(signals).toHaveLength(2);
        expect(signals[1]?.aborted).toBe(false);
        expect(registry.getModuleApi("preview")).toBe("api");
        expect(registry.runningModuleSettings("preview")).toEqual({size: 2});
    });

    it("setup이 끝나기 전에는 api가 없다", async () => {
        const gate = Promise.withResolvers<void>();
        void load([testModule({id: "preview", setup: async () => {
            await gate.promise;
            return "api";
        }})]);
        await tick();
        expect(registry.getModuleApi("preview")).toBeUndefined();

        gate.resolve();
        await tick();
        expect(registry.getModuleApi("preview")).toBe("api");
    });

    it("setup 중에 꺼지면 api를 내놓지 않고 늦게 건 정리는 바로 푼다", async () => {
        document.body.innerHTML = "<p class='target'></p>";
        const gate = Promise.withResolvers<void>();
        const cleanup = vi.fn();
        const filtered = vi.fn();
        const listener = vi.fn();
        await load([testModule({
            id: "preview", settings: {size}, defaultEnable: false, setup: async (ctx) => {
                await gate.promise;
                ctx.addCleanup(cleanup);
                ctx.addFilter(".target", filtered);
                ctx.onSettingsChanged(listener);
                return "api";
            }
        })]);
        await setEnables({preview: true});
        await tick();

        await setEnables({preview: false});
        gate.resolve();
        await tick();

        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(filtered).not.toHaveBeenCalled();
        expect(registry.getModuleApi("preview")).toBeUndefined();
        await setSettings("preview", {size: 2});
        expect(listener).not.toHaveBeenCalled();
    });

    it("addFilter는 지금 있는 요소에 걸고, 끄면 풀린다", async () => {
        document.body.innerHTML = "<p class='target'></p>";
        const filtered = vi.fn();
        await load([testModule({id: "a", setup: (ctx) => void ctx.addFilter(".target", filtered)})]);
        expect(filtered).toHaveBeenCalledTimes(1);

        await setEnables({a: false});
        document.body.append(Object.assign(document.createElement("p"), {className: "target"}));
        await tick();
        expect(filtered).toHaveBeenCalledTimes(1);
    });
});

describe("stopAll", () => {
    it("revoke 없이 멈추고 다시 켜지 않는다", async () => {
        const revoke = vi.fn();
        const setup = vi.fn((ctx: ModuleContext) => ctx.signal);
        await load([testModule({id: "a", revoke, setup})]);

        registry.stopAll();
        expect(setup.mock.results[0]?.value).toHaveProperty("aborted", true);
        expect(revoke).not.toHaveBeenCalled();

        await setEnables({a: false});
        await setEnables({a: true});
        await tick();
        expect(setup).toHaveBeenCalledTimes(1);
    });

    it("불러오는 중에 멈추면 그 뒤에 켜지 않는다", async () => {
        const ready = Promise.withResolvers<void[]>();
        const setup = vi.fn();
        const loading = load([testModule({id: "a", setup})], undefined, ready.promise);
        await tick();

        registry.stopAll();
        ready.resolve([]);
        await loading;

        expect(setup).not.toHaveBeenCalled();
    });
});

describe("단축키·페이지 토글", () => {
    const toggled = vi.fn();
    const withToggles = (id: string, defaultEnable = true) => testModule({
        id,
        defaultEnable,
        setup: () => ({count: 2, on: true}),
        shortcuts: {jump: (ctx, api) => toggled(id, ctx.signal.aborted, api)},
        pageToggles: [
            {id: "fixed", label: "고정", icon: Puzzle, desc: "설명", isOn: (api) => api.on, toggle: (api) => toggled(id, api)},
            {id: "count", label: "개수", icon: Puzzle, desc: (api) => `${api.count}개`, isOn: () => false, toggle: () => {}}
        ]
    });

    it("돌고 있는 모듈의 단축키만 api와 함께 부른다", async () => {
        await load([withToggles("on"), withToggles("off", false)]);

        registry.runShortcut("jump");
        registry.runShortcut("none");

        expect(toggled).toHaveBeenCalledTimes(1);
        expect(toggled).toHaveBeenCalledWith("on", false, {count: 2, on: true});
    });

    it("토글 상태는 돌고 있는 모듈 것만, desc 함수는 계산한다", async () => {
        await load([withToggles("on"), withToggles("off", false)]);

        expect(registry.pageToggleStates()).toEqual([
            {module: "on", id: "fixed", label: "고정", desc: "설명", on: true},
            {module: "on", id: "count", label: "개수", desc: "2개", on: false}
        ]);
    });

    it("runPageToggle은 그 모듈의 그 토글만 부른다", async () => {
        await load([withToggles("on"), withToggles("off", false)]);

        registry.runPageToggle({module: "off", id: "fixed"});
        registry.runPageToggle({module: "on", id: "missing"});
        expect(toggled).not.toHaveBeenCalled();

        registry.runPageToggle({module: "on", id: "fixed"});
        expect(toggled).toHaveBeenCalledWith("on", {count: 2, on: true});
    });

    it("settledPageToggleStates는 저장소를 다시 읽고 켜지는 모듈을 기다린다", async () => {
        const gate = Promise.withResolvers<void>();
        await load([testModule({
            id: "late", defaultEnable: false,
            setup: async () => {
                await gate.promise;
                return true;
            },
            pageToggles: [{id: "t", label: "", icon: Puzzle, desc: "", isOn: (api) => api, toggle: () => {}}]
        })]);
        // 감시 알림이 아직 오지 않은 상태다.
        muteWatchers();
        await setEnables({late: true});

        const states = registry.settledPageToggleStates();
        await tick();
        gate.resolve();

        expect(await states).toEqual([{module: "late", id: "t", label: "", desc: "", on: true}]);
    });

    it("컨텍스트가 끝난 뒤에는 다시 읽지 않는다", async () => {
        const controller = new AbortController();
        await load([], controller.signal);
        controller.abort();
        const get = vi.spyOn(fakeBrowser.storage.local, "get");

        await registry.settledPageToggleStates();

        expect(get).not.toHaveBeenCalled();
    });
});

describe("bfcache 복원", () => {
    it("놓친 설정을 먼저 맞춘 뒤 on/off를 다시 맞춘다", async () => {
        await setEnables({a: false});
        const setup = vi.fn((ctx: ModuleContext) => ctx.settings.size);
        const revoke = vi.fn();
        await load([
            testModule({id: "a", settings: {size}, setup}),
            testModule({id: "b", revoke, setup: () => {}})
        ]);

        muteWatchers();
        await setSettings("a", {size: 9});
        await setEnables({a: true, b: false});
        vi.restoreAllMocks();

        window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted: true}));
        await vi.waitFor(() => expect(setup).toHaveReturnedWith(9));
        expect(revoke).toHaveBeenCalledTimes(1);
    });
});
