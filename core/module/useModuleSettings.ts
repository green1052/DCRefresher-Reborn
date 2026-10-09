import {useStore} from "zustand";

import {moduleSettings, moduleSettingsStore, runningModulesStore} from "./registry";
import type {ModuleSettings} from "./types";

/**
 * 모듈의 현재 설정 (React). 옵션에서 바꾸면 다시 그린다. 설정을 UI 스토어로 옮겨 적지 않고 여기서 읽는다.
 * 스토어는 콘텐츠 스크립트의 loadAll만 채우므로 옵션·팝업에서는 undefined다. 콘텐츠 전용 UI는 useContentModuleSettings를 쓴다.
 */
export const useModuleSettings = <Id extends keyof ModuleSettings>(id: Id): ModuleSettings[Id] | undefined =>
    useStore(moduleSettingsStore, (state) => moduleSettings(id, state));

/**
 * 콘텐츠 스크립트 전용. loadAll이 오버레이를 그리기 전에 모든 모듈의 기본값을 채우므로 늘 있다.
 * 옵션·팝업에서 부르면 던진다.
 */
export const useContentModuleSettings = <Id extends keyof ModuleSettings>(id: Id): ModuleSettings[Id] => {
    const settings = useModuleSettings(id);
    if (!settings) throw new Error(`Module settings are not loaded: ${id}`);
    return settings;
};

/**
 * 이 페이지에서 도는 모듈의 설정 (React). 꺼져 있거나 이 페이지에서 돌지 않으면 undefined다.
 * useModuleSettings는 꺼진 모듈의 설정도 주므로, 다른 모듈이 돌 때만 그 설정을 따르는 UI(미리보기의 차단·배지)는 이것을 쓴다.
 */
export const useRunningModuleSettings = <Id extends keyof ModuleSettings>(id: Id): ModuleSettings[Id] | undefined => {
    const running = useStore(runningModulesStore, (state) => state[id] === true);
    const settings = useModuleSettings(id);
    return running ? settings : undefined;
};
