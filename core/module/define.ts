import type {AnyModule, ModuleDefinition, SettingsSchema} from "./types";

/**
 * 기능 모듈 정의. 설정 스키마(S)와 setup의 리턴값(Api)을 추론해 ctx.settings·단축키·팝업 토글에 타입을 준다.
 * 레지스트리·옵션·팝업은 여러 모듈을 한데 다루므로 AnyModule로 타입을 지워 넘긴다. 타입 검사는 모듈 정의 안에서 이미 끝났다.
 */
export const defineModule = <const S extends SettingsSchema = {}, Api = void>(definition: ModuleDefinition<S, Api>): AnyModule =>
    definition as unknown as AnyModule;
