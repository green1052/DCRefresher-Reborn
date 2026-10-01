import {addFilter} from "@/core/filtering";
import {documentUrl} from "@/core/http/urls";
import type {PageAction, PageToggleState} from "@/core/messaging/protocol";
import {storage} from "wxt/utils/storage";

import {MODULES_KEY, moduleSettingsKey} from "@/core/storage/items";
import {watchStorage} from "@/core/storage/sync";
import type {SettingValue} from "@/core/storage/types";
import {onBfcacheRestore} from "@/utils/dom";

import {areEqual, enablesOf, isModuleEnabled, readModuleStorage, settingsOf} from "./settings";
import type {AnyModule, ModuleApis, ModuleContext} from "./types";

interface ModuleInstance {
    def: AnyModule;
    settings: Record<string, SettingValue>;
    /** 실행 중일 때만 있다. ready는 setup이 끝나 api가 준비됐다는 뜻이며, 단축키·팝업 토글은 그때부터 받는다 */
    running?: { ctx: ModuleContext; controller: AbortController; ready: boolean; api?: unknown; setup?: Promise<void> };
}

const instances = new Map<string, ModuleInstance>();
/**
 * stopAll 뒤에는 다시 켜지 않는다. 새 스크립트가 주입되어 무효화된 경우 확장은 살아 있다. on/off·설정 감시와 bfcache 처리는
 * 컨텍스트 signal로 풀리지만, 불러오는 중이던 register·sync는 그 뒤에도 끝까지 돈다. 여기서 켜면 새 스크립트의 모듈과 두 벌로 돈다
 */
let stopped = false;

/** 시작 중이면 그 setup을 기다린다 */
const start = async (instance: ModuleInstance): Promise<void> => {
    if (stopped) return;
    if (instance.running) return instance.running.setup;

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

    running.setup = (async () => {
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
    })();
    return running.setup;
};

/** keepDom이면 revoke 없이 리스너·타이머만 푼다. abort를 revoke보다 먼저 해서 revoke가 던져도 리스너가 남지 않게 한다 */
const stop = (instance: ModuleInstance, keepDom = false): void => {
    const running = instance.running;
    if (!running) return;
    instance.running = undefined;

    running.controller.abort();
    if (!keepDom) instance.def.revoke?.();
};

/** 저장된 설정을 반영. 바뀐 값만 onChanged로 알린다. stored는 저장소에서 온 그대로(없으면 null)라 모양을 검사한다 */
const applySettings = (instance: ModuleInstance, stored: unknown): void => {
    for (const [key, next] of Object.entries(settingsOf(instance.def, stored))) {
        if (areEqual(instance.settings[key], next)) continue;

        instance.settings[key] = next;
        if (instance.running) instance.def.onChanged?.(instance.running.ctx, key);
    }
};

/** 모듈 on/off와 모든 모듈의 설정. 따로 읽으면 왕복이 모듈 수만큼 쌓여 첫 모듈이 늦게 뜬다 */
const readAll = (defs: AnyModule[]) => readModuleStorage(defs.map((def) => def.id));

const register = async (def: AnyModule, stored: unknown, enables: Promise<Record<string, unknown>>, signal: AbortSignal): Promise<void> => {
    if (instances.has(def.id)) throw new Error(`${def.id} is already registered.`);

    const instance: ModuleInstance = {def, settings: {}};
    instances.set(def.id, instance);

    // 설정은 옵션 페이지가 저장소에 직접 쓰고, 여기서 감시해 반영한다
    if (def.settings) {
        applySettings(instance, stored);
        watchStorage(moduleSettingsKey(def.id), (next) => applySettings(instance, next), signal);
    }

    if (isModuleEnabled(def, await enables)) await start(instance);
};

/**
 * 다른 모듈의 api. 그 모듈이 이 페이지에서 돌고 setup이 끝났을 때만 있고, 아니면 undefined.
 * 타입은 그 모듈이 ModuleApis에 선언한 것으로 단언한다 (레지스트리는 모듈별 타입을 모른다)
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

/** loadAll이 끝난 뒤에 생긴다. 저장소의 on/off를 다시 읽어 맞추고, 시작하는 모듈의 setup을 기다린다 */
let resync: (() => Promise<void>) | null = null;

/**
 * 팝업이 묻는 토글 상태. 팝업은 모듈을 켜고 끈 저장이 끝난 뒤에 묻는데, 저장소 감시 알림은 그보다 늦게 올 수 있으므로
 * 저장소를 직접 읽어 맞추고 모듈이 다 뜬 뒤에 답한다
 */
export const settledPageToggleStates = async (): Promise<PageToggleState[]> => {
    await resync?.();
    return pageToggleStates();
};

/** 팝업에서 누른 토글을 실행한다 */
export const runPageToggle = ({module, id}: PageAction): void => {
    const found = readyModules().find(({def}) => def.id === module);
    found?.def.pageToggles?.find((toggle) => toggle.id === id)?.toggle(found.running.api);
};

/**
 * 모든 모듈 중지 (콘텐츠 스크립트 컨텍스트가 무효화됐을 때). 해제 함수 하나가 던져도 abort 리스너라 나머지는 계속 돈다.
 * revoke는 부르지 않고 페이지를 지금 모습대로 둔다. 부르면 확장을 업데이트할 때 열린 탭마다 차단·스텔스·레이아웃이 풀려
 * 새로고침 전까지 가린 내용이 드러난다
 */
export const stopAll = (): void => {
    stopped = true;
    for (const instance of instances.values()) stop(instance, true);
};

/** on/off 값에 맞춰 모듈을 시작·중지하고, 시작하는 모듈의 setup을 기다린다 */
const sync = async (enables: Record<string, unknown>): Promise<void> => {
    const starts: Promise<void>[] = [];
    for (const instance of instances.values()) {
        if (isModuleEnabled(instance.def, enables)) starts.push(start(instance).catch((e) => console.error(e)));
        else stop(instance);
    }
    await Promise.all(starts);
};

/**
 * 모듈을 일괄 등록하고, 옵션 페이지의 on/off(저장소)를 감시해 시작/중지한다. signal은 콘텐츠 스크립트 컨텍스트의 것이다.
 * setup은 ready(차단·메모 스토어 초기화)가 끝난 뒤에 돈다
 */
export const loadAll = async (defs: AnyModule[], signal: AbortSignal, ready?: Promise<void[]>): Promise<void> => {
    // 이 문서의 주소(documentUrl)는 바뀌지 않으므로 urls가 이 페이지를 빼는 모듈은 끝내 돌지 않는다. 설정을 읽거나 감시하지 않게 등록하지 않는다
    defs = defs.filter((def) => !def.urls || def.urls.some((re) => re.test(documentUrl.href)));
    // on/off·모듈 설정을 한 번에 읽고 ready와 같이 기다린다. 차례로 기다리면 저장소 왕복이 쌓여 모듈이 본문을 한참 읽은 뒤에야 뜬다
    const all = readAll(defs);
    const enables = Promise.all([all, ready]).then(([value]) => value.enables);

    const {settings} = await all;
    const results = await Promise.allSettled(defs.map((def) => register(def, settings.get(def.id), enables, signal)));
    for (const [index, result] of results.entries()) {
        if (result.status === "rejected") console.error(`Failed to load module: ${defs[index]?.id}`, result.reason);
    }
    // 차단·메모를 못 읽었으면 여기서 멈춘다. 아래 sync가 차단 목록 없이 모듈을 켜지 않게 한다
    await enables;

    watchStorage(MODULES_KEY, (next) => void sync(enablesOf(next)), signal);
    // bfcache에서 돌아온 탭은 그사이의 on/off·설정 변경을 받지 못했다. 다시 시작하는 모듈이 새 값을 보도록 설정을 먼저 맞춘다
    onBfcacheRestore(async () => {
        // 모두 한꺼번에 읽는다. sync는 설정을 다 맞춘 뒤에 부른다
        const stored = await readAll(defs);
        for (const instance of instances.values()) {
            if (instance.def.settings) applySettings(instance, stored.settings.get(instance.def.id));
        }
        await sync(stored.enables);
    }, signal);
    // 불러오는 동안(setup이 IP DB를 읽는 동안 등) 팝업에서 켜고 끈 것은 감시 전이라 놓친다. 한 번 맞춘다 (바뀐 게 없으면 아무 일도 없다)
    resync = async () => sync(enablesOf(await storage.getItem(MODULES_KEY)));
    signal.addEventListener("abort", () => (resync = null), {once: true});
    await resync();
};
