import {addFilter} from "@/core/filtering";
import {documentUrl} from "@/core/http/urls";
import type {PageAction, PageState, PageToggleState} from "@/core/messaging/protocol";
import {storage} from "wxt/utils/storage";
import {shallow} from "zustand/vanilla/shallow";
import {createStore} from "zustand/vanilla";

import {MODULES_KEY, moduleSettingsKey} from "@/core/storage/items";
import {watchStorage} from "@/core/storage/sync";
import type {SettingValue} from "@/core/storage/types";
import {onBfcacheRestore} from "@/utils/dom";

import {enablesOf, isModuleEnabled, readModuleStorage, settingsOf} from "./settings";
import type {AnyModule, ModuleApis, ModuleContext, ModuleSettings} from "./types";

interface ModuleInstance {
    def: AnyModule;
    settings: Record<string, SettingValue>;
    /** 실행 중일 때만 있다. ready는 setup이 끝났다는 뜻. */
    running?: { ctx: ModuleContext; controller: AbortController; ready: boolean; api?: unknown; setup?: Promise<void>; listeners: ((keys: ReadonlySet<string>) => void)[]; revokers: (() => void)[] };
    /** setup 실패. 켜짐 값이 그대로면 재시도하지 않는다. */
    failed?: boolean;
    /** 멈춘 실행의 setup이 끝나면 풀린다. 끄자마자 켜면 setup이 겹치지 않게. */
    settling?: Promise<void>;
}

const instances = new Map<string, ModuleInstance>();

/** 모듈 id → 설정값. UI가 구독한다. */
export const moduleSettingsStore = createStore<Record<string, Readonly<Record<string, SettingValue>>>>(() => ({}));
/** 이 페이지에서 도는 모듈 id. 꺼진 모듈의 설정 거르기에 쓴다. */
export const runningModulesStore = createStore<Record<string, boolean>>(() => ({}));

/** 모듈의 설정. 레지스트리는 모듈별 타입을 몰라 ModuleSettings로 단언한다. */
export const moduleSettings = <Id extends keyof ModuleSettings>(id: Id, state = moduleSettingsStore.getState()): ModuleSettings[Id] | undefined =>
    state[id] as ModuleSettings[Id] | undefined;

/** 도는 모듈의 설정. 컴포넌트는 useRunningModuleSettings를 쓴다. */
export const runningModuleSettings = <Id extends keyof ModuleSettings>(id: Id): ModuleSettings[Id] | undefined =>
    runningModulesStore.getState()[id] ? moduleSettings(id) : undefined;

/** stopAll 뒤에는 다시 켜지 않는다(불러오던 register, sync가 새 스크립트와 두 벌로 돈다). */
let stopped = false;

/** 시작 중이면 그 setup을 기다린다. */
const start = async (instance: ModuleInstance): Promise<void> => {
    if (stopped) return;
    if (instance.running) return instance.running.setup;

    // await 사이 중지되면 이미 abort 상태라 그 뒤 등록은 바로 해제한다.
    const controller = new AbortController();
    const {signal} = controller;
    const addCleanup = (dispose: () => void): void => {
        if (signal.aborted) dispose();
        else signal.addEventListener("abort", () => dispose(), {once: true});
    };
    const listeners: ((keys: ReadonlySet<string>) => void)[] = [];
    const revokers: (() => void)[] = [];
    const ctx: ModuleContext = {
        settings: instance.settings,
        signal,
        addFilter: (scope, callback) => {
            if (signal.aborted) return () => {};
            const dispose = addFilter(scope, callback);
            addCleanup(dispose);
            return dispose;
        },
        addCleanup,
        onSettingsChanged: (listener) => {
            if (!signal.aborted) listeners.push(listener);
        },
        onRevoke: (revoke) => {
            // await 사이 꺼졌으면 바로 되돌리고, stopAll이면 페이지를 그대로 둔다.
            if (!signal.aborted) revokers.push(revoke);
            else if (!stopped) runRevoke(instance, revoke);
        }
    };

    const running: NonNullable<ModuleInstance["running"]> = {ctx, controller, ready: false, listeners, revokers};
    instance.running = running;
    runningModulesStore.setState({[instance.def.id]: true});

    const previous = instance.settling;
    running.setup = (async () => {
        try {
            if (previous) {
                await previous;
                // 기다리는 사이 다시 껐다.
                if (signal.aborted) return;
            }
            const api = await instance.def.setup(ctx);
            if (!signal.aborted) {
                running.api = api;
                running.ready = true;
            }
        } catch (e) {
            // 실패한 모듈을 반쪽 상태로 두지 않는다. 중지됐으면 새 실행을 건드리지 않는다.
            if (!signal.aborted) {
                stop(instance);
                instance.failed = true;
            }
            throw e;
        }
    })();
    return running.setup;
};

/** 등록한 정리 함수를 부른다. 던지면 sync가 나머지를 건너뛰니 오류만 남긴다. */
const runRevoke = (instance: ModuleInstance, revoke: () => void): void => {
    try {
        revoke();
    } catch (e) {
        console.error(`Module revoke failed: ${instance.def.id}`, e);
    }
};

/** keepDom이면 리스너만 푼다. abort를 먼저 해 정리가 던져도 리스너가 안 남게. */
const stop = (instance: ModuleInstance, keepDom = false): void => {
    const running = instance.running;
    if (!running) return;
    instance.running = undefined;
    instance.settling = running.setup?.catch(() => {});
    runningModulesStore.setState({[instance.def.id]: false});

    running.controller.abort();
    if (keepDom) return;
    for (const revoke of running.revokers) runRevoke(instance, revoke);
};

/** 저장된 설정을 반영해 바뀐 값만 리스너에 알린다. stored는 검사 전 값이다. */
const applySettings = (instance: ModuleInstance, stored: unknown): void => {
    const changed: string[] = [];
    for (const [key, next] of Object.entries(settingsOf(instance.def, stored))) {
        if (shallow(instance.settings[key], next)) continue;
        changed.push(key);
        instance.settings[key] = next;
    }
    if (changed.length === 0) return;

    moduleSettingsStore.setState({[instance.def.id]: {...instance.settings}});
    // 리스너 하나가 던져도 다른 리스너는 반영한다.
    const keys = new Set(changed);
    for (const listener of instance.running?.listeners ?? []) {
        try {
            listener(keys);
        } catch (e) {
            console.error(`Settings listener failed: ${instance.def.id}`, e);
        }
    }
};

/** on/off와 설정을 한 번에 읽는다(왕복 쌓임 방지). */
const readAll = (defs: AnyModule[]) => readModuleStorage(defs.map((def) => def.id));

const register = async (def: AnyModule, stored: unknown, enables: Promise<Record<string, unknown>>): Promise<void> => {
    if (instances.has(def.id)) throw new Error(`${def.id} is already registered.`);

    const instance: ModuleInstance = {def, settings: {}};
    instances.set(def.id, instance);

    // 설정은 옵션 페이지가 저장소에 직접 쓰고, loadAll이 건 감시가 반영한다.
    if (def.settings) applySettings(instance, stored);

    if (isModuleEnabled(def, await enables)) await start(instance);
};

/** 다른 모듈의 api. 돌고 setup이 끝났을 때만 있다. */
export const getModuleApi = <K extends keyof ModuleApis>(id: K): ModuleApis[K] | undefined => {
    const running = instances.get(id)?.running;
    return running?.ready ? (running.api as ModuleApis[K]) : undefined;
};

/** 이 페이지에서 setup이 끝난 모듈만. */
const readyModules = () => [...instances.values()].flatMap(({def, running}) => (running?.ready ? [{def, running}] : []));

/** 단축키 실행 (배경 commands → 탭). */
export const runShortcut = (command: string): void => {
    for (const {def, running} of readyModules()) {
        const shortcut = def.shortcuts?.[command];
        if (shortcut) void shortcut(running.api);
    }
};

/** 팝업 토글 상태 (이 페이지 것만). */
export const pageToggleStates = (): PageToggleState[] =>
    readyModules().flatMap(({def, running}) => (def.pageToggles ?? []).map((toggle) => ({
        module: def.id,
        id: toggle.id,
        desc: typeof toggle.desc === "function" ? toggle.desc(running.api) : toggle.desc,
        on: toggle.isOn(running.api)
    })));

/** 팝업 상태. setup이 던진 모듈도 알린다(콘솔 말고 알 길이 없다). */
export const pageState = (): PageState => ({
    toggles: pageToggleStates(),
    failed: [...instances.values()].flatMap(({def, failed}) => (failed ? [def.id] : []))
});

/** loadAll 뒤 생긴다. 저장소 on/off를 다시 읽어 맞춘다. */
let resync: (() => Promise<void>) | null = null;
/** loadAll이 끝나면 풀린다. 로딩 중 온 팝업 질문이 이것을 기다린다. */
let loading: Promise<void> | undefined;

/** 팝업 질문의 상태. 감시 알림보다 빠를 수 있어 저장소를 직접 읽는다. */
export const settledPageState = async (): Promise<PageState> => {
    // 로딩 중이면 resync가 없어 바로 답한다(안 뜬 모듈 토글이 빠진다).
    await loading;
    await resync?.();
    return pageState();
};

/** 팝업에서 누른 토글을 실행한다. */
export const runPageToggle = ({module, id}: PageAction): void => {
    const found = readyModules().find(({def}) => def.id === module);
    found?.def.pageToggles?.find((toggle) => toggle.id === id)?.toggle(found.running.api);
};

/** 모든 모듈 중지. onRevoke는 안 불러 업데이트 때 가린 내용이 드러나지 않게 한다. */
export const stopAll = (): void => {
    stopped = true;
    for (const instance of instances.values()) stop(instance, true);
};

/** on/off 값에 맞춰 모듈을 시작, 중지하고, 시작하는 모듈의 setup을 기다린다. */
const sync = async (enables: Record<string, unknown>): Promise<void> => {
    const starts: Promise<void>[] = [];
    for (const instance of instances.values()) {
        if (!isModuleEnabled(instance.def, enables)) {
            instance.failed = false;
            stop(instance);
        } else if (!instance.failed) {
            starts.push(start(instance).catch((e) => console.error(e)));
        }
    }
    await Promise.all(starts);
};

/** 모듈을 일괄 등록하고 on/off를 감시해 시작/중지한다. setup은 ready 뒤에 돈다. */
const load = async (defs: AnyModule[], signal: AbortSignal, ready?: Promise<void[]>): Promise<void> => {
    // UI가 읽는 설정을 기본값으로 먼저 채운다. 미등록 모듈의 오버레이 UI도 설정을 읽는다.
    moduleSettingsStore.setState(Object.fromEntries(defs.filter((def) => def.settings).map((def) => [def.id, settingsOf(def, null)])));
    // 이 페이지가 아닌 모듈은 등록하지 않는다. 검색어에 든 글자에 걸리지 않게 경로만 본다.
    defs = defs.filter((def) => !def.urls || def.urls.some((re) => re.test(documentUrl.pathname)));
    // 한 번에 읽고 감시는 읽기 전에 건다. 등록 전에 온 값은 읽은 값 대신 쓴다.
    const early = new Map<string, unknown>();
    for (const def of defs) {
        if (!def.settings) continue;
        watchStorage(moduleSettingsKey(def.id), (next) => {
            const instance = instances.get(def.id);
            if (instance) applySettings(instance, next);
            else early.set(def.id, next);
        }, signal);
    }
    const all = readAll(defs);
    const enables = Promise.all([all, ready]).then(([value]) => value.enables);
    // 거절될 수 있으니 처리되지 않은 거절로 남지 않게 받아 둔다.
    enables.catch(() => {});

    const {settings} = await all;
    const results = await Promise.allSettled(defs.map((def) => register(def, early.has(def.id) ? early.get(def.id) : settings.get(def.id), enables)));
    for (const [index, result] of results.entries()) {
        if (result.status === "rejected") console.error(`Failed to load module: ${defs[index]?.id}`, result.reason);
    }
    // 차단, 메모를 못 읽었으면 여기서 멈춘다. 아래 sync가 차단 목록 없이 모듈을 켜지 않게 한다.
    await enables;

    watchStorage(MODULES_KEY, (next) => void sync(enablesOf(next)), signal);
    // bfcache 복귀 탭은 그사이 변경을 못 받았으니 설정을 먼저 맞춘다.
    onBfcacheRestore(async () => {
        const stored = await readAll(defs);
        for (const instance of instances.values()) {
            if (instance.def.settings) applySettings(instance, stored.settings.get(instance.def.id));
        }
        await sync(stored.enables);
    }, signal);
    // 불러오는 동안 팝업이 바꾼 on/off는 감시 전이라 놓친다. 한 번 맞춘다.
    resync = async () => sync(enablesOf(await storage.getItem(MODULES_KEY)));
    signal.addEventListener("abort", () => (resync = null), {once: true});
    await resync();
};

export const loadAll = (defs: AnyModule[], signal: AbortSignal, ready?: Promise<void[]>): Promise<void> => {
    const done = load(defs, signal, ready);
    // 실패는 loadAll을 기다리는 쪽이 받는다. 팝업 질문은 실패해도 지금 상태로 답한다.
    loading = done.catch(() => {});
    return done;
};
