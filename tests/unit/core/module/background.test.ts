import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {type BackgroundModule, startBackgroundModules} from "@/core/module/background";

import {setting, tick} from "../../../helpers";

const flag = setting({type: "check", default: true});

const backgroundModule = (fields: Partial<BackgroundModule> & Pick<BackgroundModule, "id">): BackgroundModule => ({apply: vi.fn(), ...fields});

describe("startBackgroundModules", () => {
    it("listen은 꺼져 있어도 바로 부른다", () => {
        const listen = vi.fn();
        startBackgroundModules([backgroundModule({id: "a", defaultEnable: false, listen})]);
        expect(listen).toHaveBeenCalledTimes(1);
    });

    it("돌려준 함수는 모든 모듈을 저장된 상태에 맞춘다", async () => {
        await fakeBrowser.storage.local.set({"refresher:modules": {a: false}, "refresher:module:a:settings": {flag: false, gone: 1}});
        const a = vi.fn();
        const b = vi.fn();

        await startBackgroundModules([backgroundModule({id: "a", settings: {flag}, apply: a}), backgroundModule({id: "b", apply: b})])();

        expect(a).toHaveBeenCalledWith({enabled: false, settings: {flag: false}});
        expect(b).toHaveBeenCalledWith({enabled: true, settings: {}});
    });

    it("자기 on/off가 바뀔 때만 다시 맞춘다", async () => {
        const a = vi.fn();
        startBackgroundModules([backgroundModule({id: "a", apply: a})]);

        await fakeBrowser.storage.local.set({"refresher:modules": {b: false}});
        await tick();
        expect(a).not.toHaveBeenCalled();

        await fakeBrowser.storage.local.set({"refresher:modules": {a: false, b: false}});
        await tick();
        expect(a).toHaveBeenCalledWith({enabled: false, settings: {}});
    });

    it("설정이 바뀌면 다시 맞춘다", async () => {
        const a = vi.fn();
        startBackgroundModules([backgroundModule({id: "a", settings: {flag}, apply: a})]);

        await fakeBrowser.storage.local.set({"refresher:module:a:settings": {flag: false}});
        await tick();

        expect(a).toHaveBeenCalledWith({enabled: true, settings: {flag: false}});
    });

    it("apply는 앞의 호출이 끝난 뒤에 부른다", async () => {
        const gates: PromiseWithResolvers<void>[] = [];
        const apply = vi.fn(() => {
            const gate = Promise.withResolvers<void>();
            gates.push(gate);
            return gate.promise;
        });
        const applyAll = startBackgroundModules([backgroundModule({id: "a", apply})]);

        const first = applyAll();
        const second = applyAll();
        await tick();
        expect(apply).toHaveBeenCalledTimes(1);

        gates[0]?.resolve();
        await tick();
        expect(apply).toHaveBeenCalledTimes(2);
        gates[1]?.resolve();
        await Promise.all([first, second]);
    });

    it("apply가 실패해도 던지지 않고 다음 호출은 돈다", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const apply = vi.fn().mockRejectedValueOnce(new Error("menus"));
        const applyAll = startBackgroundModules([backgroundModule({id: "a", apply})]);

        await expect(applyAll()).resolves.toBeUndefined();
        await applyAll();

        expect(apply).toHaveBeenCalledTimes(2);
        expect(error).toHaveBeenCalledWith(expect.objectContaining({message: "menus"}));
    });
});
