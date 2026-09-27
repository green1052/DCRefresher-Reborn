import type {AnyModule, ModuleDefinition, SettingsSchema} from "./types";

/**
 * 기능 모듈 정의. 설정 스키마(S)와 setup의 리턴값(Api)을 추론해 ctx.settings·단축키·팝업 토글의 타입을 맞춘다.
 * 모아 다루는 쪽(레지스트리·옵션·팝업)은 모듈마다 타입이 달라 AnyModule로 넘긴다 — 모듈 안에서는 이미 맞춰 봤으니 여기서만 지운다
 */
export const defineModule = <const S extends SettingsSchema = {}, Api = void>(definition: ModuleDefinition<S, Api>): AnyModule =>
    definition as unknown as AnyModule;
