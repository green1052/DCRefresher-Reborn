/** 기능 모듈 테스트 도우미 (tests/unit/features 전용). 레지스트리·저장소 없이 setup을 한 번 돌린다. */
import {addFilter} from "@/core/filtering";
import {settingsOf} from "@/core/module/settings";
import type {AnyModule, ModuleContext} from "@/core/module/types";
import type {SettingValue} from "@/core/storage/types";

export interface Running<Api> {
    api: Api;
    ctx: ModuleContext;
    /** 설정을 바꾸고 onSettingsChanged 리스너에 바뀐 키로 알린다. */
    change(patch: Record<string, SettingValue>): void;
    /** 컨텍스트가 무효화된 것처럼(stopAll) revoke 없이 리스너만 푼다. */
    abort(): void;
    /** 레지스트리처럼 리스너를 풀고 revoke를 부른다. */
    stop(): void;
}

/** 기본 설정에 patch를 덮어 setup을 돌린다. 레지스트리와 같은 모양의 ctx를 준다. */
export const runModule = async <Api>(def: AnyModule & { readonly apiType?: Api }, patch: Record<string, SettingValue> = {}): Promise<Running<Api>> => {
    const controller = new AbortController();
    const {signal} = controller;
    const settings: Record<string, SettingValue> = settingsOf(def, patch);
    const listeners: ((keys: ReadonlySet<string>) => void)[] = [];
    const addCleanup = (dispose: () => void): void => {
        if (signal.aborted) dispose();
        else signal.addEventListener("abort", () => dispose(), {once: true});
    };
    const ctx: ModuleContext = {
        settings,
        signal,
        addFilter: (scope, callback) => {
            const dispose = addFilter(scope, callback);
            addCleanup(dispose);
            return dispose;
        },
        addCleanup,
        onSettingsChanged: (listener) => void listeners.push(listener)
    };

    // defineModule이 지운 api 타입을 apiType으로 되찾는다 (레지스트리의 getModuleApi와 같은 단언).
    const api = (await def.setup(ctx)) as Api;
    return {
        api,
        ctx,
        change: (next) => {
            Object.assign(settings, next);
            const keys = new Set(Object.keys(next));
            for (const listener of listeners) listener(keys);
        },
        abort: () => controller.abort(),
        stop: () => {
            controller.abort();
            def.revoke?.();
        }
    };
};
