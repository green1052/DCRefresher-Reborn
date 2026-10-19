// @vitest-environment node
import {describe, expect, it, vi} from "vitest";
import {storage} from "wxt/utils/storage";

import {type BackgroundModule, startBackgroundModules} from "@/core/module/background";
import {MODULES_KEY, moduleSettingsKey} from "@/core/storage/items";

import {setting, tick} from "../../../helpers";

type Apply = NonNullable<BackgroundModule["apply"]>;

/** 설정 x 하나를 가진 배경 모듈 a. apply는 돌려준 release를 부를 때까지 끝나지 않는다. */
const pendingModule = () => {
    const releases: (() => void)[] = [];
    const apply = vi.fn<Apply>(() => new Promise<void>((resolve) => void releases.push(resolve)));
    const module: BackgroundModule = {id: "a", settings: {x: setting({type: "check", default: false})}, apply};
    return {module, apply, release: () => releases.shift()?.()};
};

describe("startBackgroundModules", () => {
    it("저장소가 연달아 바뀌어도 앞의 apply가 끝난 뒤에 다음 apply를 부른다", async () => {
        const {module, apply, release} = pendingModule();
        startBackgroundModules([module]);

        await storage.setItem(MODULES_KEY, {a: false});
        await storage.setItem(moduleSettingsKey("a"), {x: true});
        await tick();
        expect(apply).toHaveBeenCalledTimes(1);

        release();
        await tick();
        expect(apply).toHaveBeenCalledTimes(2);
        expect(apply).toHaveBeenLastCalledWith({enabled: false, settings: {x: true}});
    });

    it("다른 모듈의 on/off만 바뀌면 다시 맞추지 않는다", async () => {
        const {module, apply} = pendingModule();
        await storage.setItem(MODULES_KEY, {a: true, b: true});
        startBackgroundModules([module]);

        await storage.setItem(MODULES_KEY, {a: true, b: false});
        await storage.setItem(moduleSettingsKey("b"), {x: true});
        await tick();
        expect(apply).not.toHaveBeenCalled();

        await storage.setItem(MODULES_KEY, {a: false, b: false});
        await tick();
        expect(apply).toHaveBeenCalledOnce();
        expect(apply).toHaveBeenCalledWith({enabled: false, settings: {x: false}});
    });

    it("돌려준 함수는 지금 상태로 모든 모듈을 맞추고, apply 오류는 남기기만 한다", async () => {
        const error = new Error("menu");
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const listen = vi.fn();
        const good = vi.fn<Apply>();
        await storage.setItem(MODULES_KEY, {good: false});

        const applyAll = startBackgroundModules([
            {id: "listenOnly", listen},
            {id: "bad", apply: () => Promise.reject(error)},
            {id: "good", defaultEnable: true, apply: good}
        ]);
        expect(listen).toHaveBeenCalledOnce();

        await expect(applyAll()).resolves.toBeUndefined();
        expect(good).toHaveBeenCalledWith({enabled: false, settings: {}});
        expect(log).toHaveBeenCalledWith(error);
    });

    it("한 모듈의 listen이 던지면 남기고 그 모듈만 맞추지 않으며, 다음 모듈의 listen·apply는 돈다", async () => {
        const error = new Error("listen");
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const badApply = vi.fn<Apply>();
        const listen = vi.fn();
        const good = vi.fn<Apply>();

        const applyAll = startBackgroundModules([
            {
                id: "bad", apply: badApply, listen: () => {
                    throw error;
                }
            },
            {id: "good", listen, apply: good}
        ]);
        expect(log).toHaveBeenCalledWith("Background module listen failed: bad", error);
        expect(listen).toHaveBeenCalledOnce();

        await applyAll();
        expect(badApply).not.toHaveBeenCalled();
        expect(good).toHaveBeenCalledOnce();
    });
});
