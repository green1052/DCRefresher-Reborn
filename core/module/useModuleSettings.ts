import {useStore} from "zustand";

import {moduleSettingsStore} from "./registry";
import type {ModuleSettings} from "./types";

/**
 * 모듈의 현재 설정 (React). 옵션에서 바꾸면 다시 그린다. 설정을 UI 스토어로 옮겨 적지 않고 여기서 읽는다.
 * 그 모듈이 이 페이지에 등록되어 있어야 한다 (모듈의 UI는 모듈이 도는 페이지에서만 그려진다).
 */
export const useModuleSettings = <Id extends keyof ModuleSettings>(id: Id): ModuleSettings[Id] =>
    useStore(moduleSettingsStore, (state) => state[id]) as unknown as ModuleSettings[Id];
