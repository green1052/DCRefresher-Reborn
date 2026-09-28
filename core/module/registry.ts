import {addFilter} from "@/core/filtering";
import type {PageAction, PageToggleState} from "@/core/messaging/protocol";
import {moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import type {SettingValue} from "@/core/storage/types";

import {areEqual, isModuleEnabled, normalizeSettings} from "./settings";
import type {AnyModule, ModuleApis, ModuleContext} from "./types";

interface ModuleInstance {
    def: AnyModule;
    settings: Record<string, SettingValue>;
    /** 실행 중일 때만 있다. ready는 setup이 끝나 api가 준비됐다는 뜻이며, 단축키·팝업 토글은 그때부터 받는다 */
    running?: { ctx: ModuleContext; controller: AbortController; ready: boolean; api?: unknown };
}

const instances = new Map<string, ModuleInstance>();

/** 이 문서의 주소. 로드 시점에 정한다: 미리보기가 pushState로 글 주소로 바꿔도 이 문서는 그대로다 */
const pageUrl = location.href;

const start = async (instance: ModuleInstance): Promise<void> => {
    if (instance.running) return;
    if (instance.def.urls && !instance.def.urls.some((re) => re.test(pageUrl))) return;

    // 이 실행의 수명. setup이 await하는 사이 중지되면 이미 abort된 상태라, 그 뒤에 등록하는 필터·cleanup은 바로 해제한다
    const controller = new AbortController();
    const {signal} = controller;
    const addCleanup = (dispose: () => void): void => {
        if (signal.aborted) dispose();
        else signal.addEventListener("abort", () => dispose(), {once: true});
    };
    const ctx: ModuleContext = {
        settings: instance.settings,
        signal,
        addFilter: (scope, callback) => {
            if (signal.aborted) return () => {};
            const dispose = addFilter(scope, callback);
            addCleanup(dispose);
            return dispose;
        },
        addCleanup
    };

    const running: NonNullable<ModuleInstance["running"]> = {ctx, controller, ready: false};
    instance.running = running;

    try {
        const api = await instance.def.setup(ctx);
        if (!signal.aborted) {
            running.api = api;
            running.ready = true;
        }
    } catch (e) {
        // 실패한 모듈을 반쪽 상태로 두지 않는다. 그사이 중지됐으면(재시작 포함) 새 실행을 건드리지 않는다
        if (!signal.aborted) stop(instance);
        throw e;
    }
};

/** keepDom이면 revoke 없이 리스너·타이머만 푼다. abort를 revoke보다 먼저 해서 revoke가 던져도 리스너가 남지 않게 한다 */
const stop = (instance: ModuleInstance, keepDom = false): void => {
    const running = instance.running;
    if (!running) return;
    instance.running = undefined;

    running.controller.abort();
    if (!keepDom) instance.def.revoke?.();
};

/** 저장된 설정을 반영. 바뀐 값만 onChanged로 알린다 */
const applySettings = (instance: ModuleInstance, stored: Record<string, unknown> | null): void => {
    for (const [key, next] of Object.entries(normalizeSettings(instance.def, stored))) {
        if (areEqual(instance.settings[key], next)) continue;

        instance.settings[key] = next;
        if (instance.running) instance.def.onChanged?.(instance.running.ctx, key);
    }
};

const register = async (def: AnyModule, enable: boolean): Promise<void> => {
    if (instances.has(def.id)) throw new Error(`${def.id} is already registered.`);

    const instance: ModuleInstance = {def, settings: {}};
    instances.set(def.id, instance);

    // 설정은 옵션 페이지가 저장소에 직접 쓰고, 여기서 감시해 반영한다
    if (def.settings) {
        const settingsItem = moduleSettingsStorage(def.id);
        applySettings(instance, await settingsItem.getValue());
        settingsItem.watch((next) => applySettings(instance, next));
    }

    if (enable) await start(instance);
};

/**
 * 다른 모듈의 api. 그 모듈이 이 페이지에서 돌고 setup이 끝났을 때만 있고, 아니면 undefined.
 * 타입은 그 모듈이 ModuleApis에 선언한 것으로 단언한다 (레지스트리는 모듈별 타입을 모른다).
 */
export const getModuleApi = <K extends keyof ModuleApis>(id: K): ModuleApis[K] | undefined => {
    const running = instances.get(id)?.running;
    return running?.ready ? (running.api as ModuleApis[K]) : undefined;
};

/** 이 페이지에서 setup이 끝난 모듈. 꺼져 있거나, 이 페이지에서 안 돌거나, 아직 시작 중인 모듈은 빠진다 */
const readyModules = () => [...instances.values()].flatMap(({def, running}) => (running?.ready ? [{def, running}] : []));

/** 단축키 실행 (배경의 commands → 탭). 이 페이지에서 도는 모듈의 shortcuts만 */
export const runShortcut = (command: string): void => {
    for (const {def, running} of readyModules()) {
        const shortcut = def.shortcuts?.[command];
        if (shortcut) void shortcut(running.ctx, running.api);
    }
};

/** 팝업 '현재 페이지'의 토글 상태. 이 페이지에서 도는 모듈의 것만 담는다 */
export const pageToggleStates = (): PageToggleState[] =>
    readyModules().flatMap(({def, running}) => (def.pageToggles ?? []).map((toggle) => ({
        module: def.id,
        id: toggle.id,
        label: toggle.label,
        desc: typeof toggle.desc === "function" ? toggle.desc(running.api) : toggle.desc,
        on: toggle.isOn(running.api)
    })));

/** 팝업에서 누른 토글을 실행한다 */
export const runPageToggle = ({module, id}: PageAction): void => {
    const found = readyModules().find(({def}) => def.id === module);
    found?.def.pageToggles?.find((toggle) => toggle.id === id)?.toggle(found.running.api);
};

/**
 * 모든 모듈 중지 (콘텐츠 스크립트 컨텍스트가 무효화됐을 때). 해제 함수 하나가 던져도 abort 리스너라 나머지는 계속 돈다.
 * revoke는 부르지 않고 페이지를 지금 모습대로 둔다. 부르면 확장을 업데이트할 때 열린 탭마다 차단·스텔스·레이아웃이 풀려
 * 새로고침 전까지 가린 내용이 드러난다.
 */
export const stopAll = (): void => {
    for (const instance of instances.values()) stop(instance, true);
};

/** 모듈을 일괄 등록하고, 옵션 페이지의 on/off(저장소)를 감시해 시작/중지한다. signal은 콘텐츠 스크립트 컨텍스트의 것이다 */
export const loadAll = async (defs: AnyModule[], signal: AbortSignal): Promise<void> => {
    const enables = await modulesStorage.getValue();

    const results = await Promise.allSettled(defs.map((def) => register(def, isModuleEnabled(def, enables))));
    for (const [index, result] of results.entries()) {
        if (result.status === "rejected") console.error(`Failed to load module: ${defs[index]?.id}`, result.reason);
    }

    const sync = (next: Record<string, boolean>): void => {
        for (const instance of instances.values()) {
            if (isModuleEnabled(instance.def, next)) void start(instance).catch((e) => console.error(e));
            else stop(instance);
        }
    };
    modulesStorage.watch(sync);
    // bfcache에서 돌아온 탭은 그사이의 on/off·설정 변경을 받지 못했다. 다시 시작하는 모듈이 새 값을 보도록 설정을 먼저 맞춘다.
    // 무효화된 뒤에는 저장소를 부를 수 없으므로 signal로 리스너를 뗀다
    window.addEventListener("pageshow", (ev) => {
        if (!ev.persisted) return;
        void (async () => {
            // 모두 한꺼번에 읽는다. sync는 설정을 다 맞춘 뒤에 부른다
            const [enables] = await Promise.all([
                modulesStorage.getValue(),
                ...[...instances.values()].map(async (instance) => {
                    if (instance.def.settings) applySettings(instance, await moduleSettingsStorage(instance.def.id).getValue());
                })
            ]);
            sync(enables);
        })().catch(console.error);
    }, {signal});
    // 불러오는 동안(setup이 IP DB를 읽는 동안 등) 팝업에서 켜고 끈 것은 감시 전이라 놓친다. 한 번 맞춘다 (바뀐 게 없으면 아무 일도 없다)
    sync(await modulesStorage.getValue());
};
