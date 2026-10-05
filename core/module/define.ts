import type {DefinedModule, ModuleDefinition, ModuleMeta, SettingsSchema} from "./types";

/**
 * 모듈 메타(features/<id>/meta.ts). 설정 스키마를 리터럴 그대로(const) 남겨, index.ts가 {...meta, setup}으로 펼칠 때
 * ctx.settings의 키마다 정확한 타입이 나오게 한다. 옵션·팝업은 features/meta.ts의 glob으로 이것만 모은다.
 */
export const defineModuleMeta = <const Id extends string, const S extends SettingsSchema = {}>(meta: ModuleMeta<S> & { id: Id }): ModuleMeta<S> & { id: Id } => meta;

/**
 * 기능 모듈 정의. 설정 스키마(S)와 setup의 리턴값(Api)을 추론해 ctx.settings·단축키·팝업 토글에 타입을 준다.
 * 레지스트리·옵션·팝업은 여러 모듈을 한데 다루므로 AnyModule로 타입을 지워 넘긴다. 타입 검사는 모듈 정의 안에서 이미 끝났다.
 */
export const defineModule = <const Id extends string, const S extends SettingsSchema = {}, Api = void>(definition: ModuleDefinition<S, Api> & { id: Id }): DefinedModule<Id, Api> =>
    definition as unknown as DefinedModule<Id, Api>;
