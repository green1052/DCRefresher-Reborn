import type {ModuleDefinition} from "./types";

/** 기능 모듈 정의 — 타입 추론용 헬퍼 (WXT의 defineContentScript와 같은 방식) */
export const defineModule = (definition: ModuleDefinition): ModuleDefinition => definition;
